/// <reference path="../kg.ts" />

module KG {

    export interface ODESystemDefinition extends MathFunctionDefinition {
        dxdt: string;
        dydt: string;
        initial: [any, any];
        steps?: number;
        dt?: number;
        showDots?: any;
        dotSpacing?: any;
        dotRadius?: any;
        dotColor?: any;
        animation?: any;
        speed?: any;
        movingDotColor?: any;
        movingDotRadius?: any;
        restartDelay?: any;
    }

    export interface IODESystem extends IMathFunction {
        evaluate: (t: number) => { x: number, y: number };
        generateData: () => { x: number, y: number }[];
        generateDots: () => { x: number, y: number }[];
    }

    export class ODESystemFunction extends MathFunction implements IODESystem {

        private dxdtDef: string;
        private dydtDef: string;
        private dxdtCompiled: math.EvalFunction;
        private dydtCompiled: math.EvalFunction;
        private initial: [number, number];
        private steps: number;
        private dt: number;

        private lastInitial: [number, number];
        private lastParams: Record<string, number>;

        // ---- Main data ----
        public data: { x: number, y: number }[] = [];
        public dots: { x: number, y: number }[] = [];

        // ---- Visuals ----
        public showDots: boolean;
        public dotSpacing: number;
        public dotRadius: number;
        public dotColor: string;
        public animation: boolean;
        public speed: number;
        public movingDotColor: string;
        public movingDotRadius: number;
        public restartDelay: number;


        // Version number (used by Curve to detect real changes)
        public version: number = 0;

        constructor(def: ODESystemDefinition) {
            super(def);

            setDefaults(def, {
                steps: 400,
                dt: 0.05,
                showDots: false,
                dotSpacing: 60,
                dotRadius: 3,
                dotColor: "green",
                animation: false,
                speed: 1.0,
                movingDotColor: "red",
                movingDotRadius: 5,
                restartDelay: 1000 
            });

            this.dxdtDef = def.dxdt;
            this.dydtDef = def.dydt;
            this.steps = def.steps!;
            this.dt = def.dt!;
            this.initial = def.initial || [0, 0];
            this.lastInitial = [NaN, NaN];
            this.lastParams = {};

            // --- Dynamic evaluation of visual attributes (supports params.*) ---
            this.showDots = this.evaluateExpr(def.showDots, def.model);
            this.dotSpacing = this.evaluateExpr(def.dotSpacing, def.model);
            this.dotRadius = this.evaluateExpr(def.dotRadius, def.model);
            this.dotColor = this.evaluateExpr(def.dotColor, def.model);
            this.animation = this.evaluateExpr(def.animation, def.model);
            this.speed = this.evaluateExpr(def.speed, def.model);
            this.movingDotColor = this.evaluateExpr(def.movingDotColor, def.model);
            this.movingDotRadius = this.evaluateExpr(def.movingDotRadius, def.model);
            this.restartDelay = this.evaluateExpr(def.restartDelay, def.model);

            console.log("ODESystemFunction created");
        }

        // ============================================================
        // 1. Generic evaluator for expressions (params, calcs, colors)
        //    (public so Curve can synchronize fn.animation)
        // ============================================================
        public evaluateExpr(expr: any, model: any): any {
            if (expr === undefined || expr === null) return expr;
            if (typeof expr === "boolean" || typeof expr === "number") return expr;

            if (typeof expr === "string") {
                const trimmed = expr.trim();

                // 1. Protects literals and color strings
                if (
                    trimmed.startsWith("'") || trimmed.startsWith('"') ||    // already quoted string
                    trimmed.startsWith('#') ||                               // hex color
                    trimmed.startsWith('rgb') || trimmed.startsWith('hsl')   // rgb(), rgba(), hsl()
                ) {
                    return trimmed.replace(/^['"]|['"]$/g, ''); // remove outer quotes if any
                }

                // 2. Try to evaluate as a JavaScript expression (e.g., params.a + params.b)
                try {
                    const f = new Function(
                        "params", "calcs", "colors",
                        "with(params){with(calcs){with(colors){return " + expr + ";}}}"
                    );
                    return f(model.currentParamValues, model.currentCalcValues, model.currentColors);
                } catch (e) {
                    console.warn("Error evaluating expression:", expr, e);
                    return expr; // literal fallback
                }
            }

            return expr;
        }

        // ============================================================
        // 2. Derivatives and RK4 solver
        // ============================================================
        private deriv(state: { x: number; y: number }, scope: any) {
            let dx = 0, dy = 0;
            try { dx = this.dxdtCompiled.evaluate({ x: state.x, y: state.y, ...scope.params }); } catch { dx = 0; }
            try { dy = this.dydtCompiled.evaluate({ x: state.x, y: state.y, ...scope.params }); } catch { dy = 0; }
            return { dx, dy };
        }

        private rk4Step(s: { x: number, y: number }, scope: any, h: number) {
            const k1 = this.deriv(s, scope);
            const s2 = { x: s.x + 0.5 * h * k1.dx, y: s.y + 0.5 * h * k1.dy };
            const k2 = this.deriv(s2, scope);
            const s3 = { x: s.x + 0.5 * h * k2.dx, y: s.y + 0.5 * h * k2.dy };
            const k3 = this.deriv(s3, scope);
            const s4s = { x: s.x + h * k3.dx, y: s.y + h * k3.dy };
            const k4 = this.deriv(s4s, scope);
            return {
                x: s.x + (h / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
                y: s.y + (h / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy)
            };
        }

        // ============================================================
        // 3. Data and dots generation
        // ============================================================
        generateData() {
            const fn = this;

            fn.scope = {
                params: fn.model.currentParamValues,
                calcs: fn.model.currentCalcValues,
                colors: fn.model.currentColors
            };

            const params = fn.scope.params as Record<string, number>;
            const x0 = (params["px"] != null) ? params["px"] : fn.initial[0];
            const y0 = (params["py"] != null) ? params["py"] : fn.initial[1];

            fn.dxdtCompiled = math.compile(fn.updateFunctionString(fn.dxdtDef, fn.scope));
            fn.dydtCompiled = math.compile(fn.updateFunctionString(fn.dydtDef, fn.scope));

            const data: { x: number, y: number }[] = [];
            let state = { x: x0, y: y0 };
            data.push({ ...state });

            for (let i = 0; i < fn.steps; i++) {
                state = this.rk4Step(state, fn.scope, fn.dt);
                data.push({ ...state });
            }

            this.data = data;
            this.version = (this.version || 0) + 1; // increments version when data changes
            console.log(`generateData(): ${data.length} points generated. v=${this.version}`);
            return data;
        }

        public generateDots() {
            if (!this.showDots || !this.data || this.data.length === 0) {
                return [];
            }

            let dotSpacing = this.dotSpacing || 10;
            const dots: { x: number, y: number }[] = [];

            if (dotSpacing < 1) {
                const totalSteps = this.data.length;
                dotSpacing = Math.max(1, Math.floor(totalSteps * dotSpacing));
            }

            for (let i = 0; i < this.data.length; i += dotSpacing) {
                dots.push(this.data[i]);
            }

            this.dots = dots;
            console.log(`generateDots(): ${dots.length} dots created (spacing=${dotSpacing})`);
            return dots;
        }

        evaluate(t: number) {
            const i = Math.min(Math.floor(t / this.dt), this.data.length - 1);
            return this.data[i];
        }

        // ============================================================
        // 4. Update
        // ============================================================
        update(force) {
            const fn = super.update(force);

            fn.scope = {
                params: fn.model.currentParamValues,
                calcs: fn.model.currentCalcValues,
                colors: fn.model.currentColors
            };

            const params = fn.scope.params as Record<string, number>;
            const x0 = (params["px"] != null) ? params["px"] : fn.initial[0];
            const y0 = (params["py"] != null) ? params["py"] : fn.initial[1];

            const changedInitial =
                !fn.lastInitial ||
                fn.lastInitial[0] !== x0 ||
                fn.lastInitial[1] !== y0;

            const changedParams =
                !fn.lastParams ||
                Object.keys(params).some(k => params[k] !== fn.lastParams[k]);

            // --- re-evaluate dynamic properties ---
            fn.showDots = fn.evaluateExpr(fn.showDots, fn.model);
            fn.dotSpacing = fn.evaluateExpr(fn.dotSpacing, fn.model);
            fn.dotRadius = fn.evaluateExpr(fn.dotRadius, fn.model);
            fn.dotColor = fn.evaluateExpr(fn.dotColor, fn.model);
            fn.animation = fn.evaluateExpr(fn.animation, fn.model);
            fn.speed = fn.evaluateExpr(fn.speed, fn.model);
            fn.movingDotColor = fn.evaluateExpr(fn.movingDotColor, fn.model);
            fn.movingDotRadius = fn.evaluateExpr(fn.movingDotRadius, fn.model);

            if (force || changedInitial || changedParams || !fn.data || fn.data.length === 0) {
                fn.lastInitial = [x0, y0];
                fn.lastParams = { ...params };
                fn.data = fn.generateData();
                if (fn.showDots) fn.generateDots();
                fn.hasChanged = true;
                if (fn.graph) fn.graph.hasChanged = true;
            } else {
                fn.hasChanged = false;
            }

            return fn;
        }
    }
}


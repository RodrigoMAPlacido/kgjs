/// <reference path='../../kg.ts' />

module KG {

    // ============================================================
    // Definition now includes ODESystemFunction
    // ============================================================
    export interface CurveDefinition extends ViewObjectDefinition {
        univariateFunction?: UnivariateFunctionDefinition;
        parametricFunction?: ParametricFunctionDefinition;
        ODESystemFunction?: ODESystemDefinition;     // [ADDED]
    }

    export class Curve extends ViewObject {

        // ============================================================
        // Class properties
        // ============================================================
        private dataLine;
        private dragPath;
        private path;
        private interpolation;

        private univariateFunction: UnivariateFunction;
        private parametricFunction: ParametricFunction;
        private odeSystemFunction: ODESystemFunction;    // [ADDED]
        private odeAnimator: AnimationODE;               // [ADDED] animation helper

        // ============================================================
        // Constructor
        // ============================================================
        constructor(def: CurveDefinition) {

            // [MODIFIED]: In the original version, super(def) was called at the end.
            // Here it is called first to ensure ViewObject initialization occurs early.
            super(def);

            // [UNCHANGED]: Set default visual parameters
            setDefaults(def, {
                interpolation: 'curveBasis',
                strokeWidth: 2
            });
            setProperties(def, 'constants', ['interpolation']);

            // [ADDED]: Instantiate the animation controller
            this.odeAnimator = new AnimationODE();

            // [MODIFIED]: Unified initialization of the supported function types.
            if (def.univariateFunction) {
                def.univariateFunction.model = def.model;
                this.univariateFunction = new UnivariateFunction(def.univariateFunction);

            } else if (def.parametricFunction) {
                def.parametricFunction.model = def.model;
                this.parametricFunction = new ParametricFunction(def.parametricFunction);

            } else if (def.ODESystemFunction) {                    // [ADDED]
                def.ODESystemFunction.model = def.model;
                this.odeSystemFunction = new ODESystemFunction(def.ODESystemFunction);
            }
        }

        // ============================================================
        // 1. Create SVG elements
        // ============================================================
        draw(layer) {
            const curve = this;

            // [MODIFIED]: Allow fallback to d3.curveLinear if interpolation is invalid
            curve.dataLine = d3.line()
                .curve((d3 as any)[curve.interpolation] || d3.curveLinear)
                .x((d: any) => curve.xScale.scale(d.x))
                .y((d: any) => curve.yScale.scale(d.y));

            // [UNCHANGED]: Create root SVG group and main paths
            curve.rootElement = layer.append('g');
            curve.dragPath = curve.rootElement.append('path')
                .attr('stroke-width', '20px')
                .style('stroke-opacity', 0)
                .style('fill', 'none');

            curve.path = curve.rootElement.append('path')
                .style('fill', 'none');

            // [ADDED]: Pre-create group where ODE dots will be drawn
            curve.rootElement.append('g').attr('class', 'ode-dots-group');

            // [ADDED]: Optional asynchronous initial redraw to ensure DOM availability
            setTimeout(() => {
                try { curve.redraw(); } catch (e) { /* ignore first redraw errors */ }
            }, 0);

            return curve.addClipPathAndArrows().addInteraction();
        }

        // ============================================================
        // 2. Redraw (includes AnimationODE for ODEs)
        // ============================================================
        redraw() {
            const curve = this;

            // [UNCHANGED]: Univariate function redraw
            if (curve.univariateFunction) {
                const fn = curve.univariateFunction;
                const scale = fn.ind === 'y' ? curve.yScale : curve.xScale;
                fn.generateData(scale.domainMin, scale.domainMax);
                curve.path.data([fn.data]).attr('d', curve.dataLine);
            }

            // [UNCHANGED]: Parametric function redraw
            if (curve.parametricFunction) {
                const fn = curve.parametricFunction;
                fn.generateData();
                curve.path.data([fn.data]).attr('d', curve.dataLine);
            }

            // [ADDED]: ODE-based function redraw with animation
            if (curve.odeSystemFunction) {
                const fn = curve.odeSystemFunction;
                this.odeAnimator.update(curve, fn);
                curve.path.data([fn.data]).attr('d', curve.dataLine);
            }

            curve.drawStroke(curve.path);
            return curve;
        }

        // ============================================================
        // 3. Logical update and change tracking
        // ============================================================
        update(force: boolean) {
            const curve = super.update(force);
            let needsRedraw = false;

            // [MODIFIED]: Unified change detection including ODE function
            if (
                force ||
                (curve.univariateFunction && curve.univariateFunction.hasChanged) ||
                (curve.parametricFunction && curve.parametricFunction.hasChanged) ||
                (curve.odeSystemFunction && curve.odeSystemFunction.hasChanged)      // [ADDED]
            ) {
                needsRedraw = true;
            }

            if (needsRedraw) curve.redraw();
            return curve;
        }
    }
}

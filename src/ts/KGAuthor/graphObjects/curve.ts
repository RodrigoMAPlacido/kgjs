/// <reference path="../kgAuthor.ts" />

module KGAuthor {

    // ============================================================
    // [ADDED] Explicit imports to reference KG-level definitions.
    // code works without them
    // ============================================================
    import UnivariateFunctionDefinition = KG.UnivariateFunctionDefinition;
    import ParametricFunctionDefinition = KG.ParametricFunctionDefinition;
    import ODESystemDefinition = KG.ODESystemDefinition;   // [ADDED] Support for ODE systems

    // ============================================================
    // Interface extension
    // ============================================================
    export interface CurveDefinition extends GraphObjectDefinition {
        label?: LabelDefinition;
        fn?: string;
        xFn?: string;
        yFn?: string;
        univariateFunction?: KG.UnivariateFunctionDefinition;
        parametricFunction?: KG.ParametricFunctionDefinition;
        ODESystemFunction?: KG.ODESystemDefinition;        // [ADDED] Support for ODE systems
        pts?: { name: string; x?: string; y?: string; }[];
        areaBelow?: string | AreaDefinition;
        areaAbove?: string | AreaDefinition;
    }

    // ============================================================
    // Curve class — extended to recognize ODESystemFunction
    // ============================================================
    export class Curve extends GraphObject {

        // [UNCHANGED]: existing function and point definitions
        public pts: string[];
        public univariateFunction: KG.UnivariateFunction;
        public parametricFunction: KG.ParametricFunction;

        // [ADDED]: support for ODE-based curve definitions
        public ODESystemFunction: KG.ODESystemFunction;

        // ============================================================
        // Constructor
        // ============================================================
        constructor(def, graph) {
            def = setStrokeColor(def);

            // [UNCHANGED]: parse basic function types
            parseFn(def, 'fn', 'univariateFunction');
            parseFn(def, 'xFn', 'parametricFunction');

            super(def, graph);

            const c = this;
            c.type = 'Curve';
            c.layer = def.layer || 1;
            c.pts = def.pts || [];

            // ============================================================
            // [ADDED] ODE support: instantiate ODESystemFunction if defined
            // ============================================================
            if (def.hasOwnProperty('ODESystemFunction')) {

                // Ensure the model exists before constructing
                if (!def.ODESystemFunction.model && def.model) {
                    def.ODESystemFunction.model = def.model;
                } else if (!def.ODESystemFunction.model) {
                    console.warn("ODESystemFunction missing model — check the parsing process.");
                }

                try {
                    c.ODESystemFunction = new KG.ODESystemFunction(def.ODESystemFunction);
                } catch (e) {
                    console.error("Error creating ODESystemFunction:", e);
                }
            }

            // ============================================================
            // [UNCHANGED] Areas below and above the curve
            // ============================================================
            if (def.hasOwnProperty('areaBelow')) {
                KG.setDefaults(def.areaBelow, { color: def.color });
                parseFill(def, 'areaBelow');
                KG.setDefaults(def.areaBelow, def.univariateFunction);
                parseFn(def.areaBelow, 'fn', 'univariateFunction1');
                c.subObjects.push(new Area(def.areaBelow, graph));
            }

            if (def.hasOwnProperty('areaAbove')) {
                KG.setDefaults(def.areaBelow, { color: def.color });
                parseFill(def, 'areaAbove');
                KG.setDefaults(def.areaAbove, def.univariateFunction);
                parseFn(def.areaAbove, 'fn', 'univariateFunction1');
                def.areaAbove.above = true;
                c.subObjects.push(new Area(def.areaAbove, graph));
            }

            // ============================================================
            // [UNCHANGED] Label handling
            // ============================================================
            if (def.hasOwnProperty('label')) {
                let labelDef = copyJSON(def);
                delete labelDef.label;
                labelDef = KG.setDefaults(labelDef, def.label);
                labelDef = KG.setDefaults(labelDef, {
                    fontSize: 12,
                    color: def.color
                });

                if (def.hasOwnProperty('univariateFunction')) {
                    if (labelDef.hasOwnProperty('x') && def.univariateFunction.ind != 'y') {
                        labelDef.coordinates = [labelDef.x, c.yOfX(labelDef.x)];
                        c.subObjects.push(new Label(labelDef, graph));
                    } else if (labelDef.hasOwnProperty('y') && def.univariateFunction.ind != 'x') {
                        labelDef.coordinates = [c.xOfY(labelDef.y), labelDef.y];
                        c.subObjects.push(new Label(labelDef, graph));
                    }
                }

                if (def.hasOwnProperty('parametricFunction')) {
                    if (labelDef.hasOwnProperty('t')) {
                        labelDef.coordinates = c.xyOfT(labelDef.t);
                        c.subObjects.push(new Label(labelDef, graph));
                    }
                }
            }
        }

        // ============================================================
        // [UNCHANGED] Function mapping helpers
        // ============================================================
        yOfX(x) {
            return `(${replaceVariable(this.def.univariateFunction.fn, '(x)', `(${x})`)})`;
        }

        xOfY(y) {
            const c = this;
            if (c.def.univariateFunction.hasOwnProperty('yFn')) {
                return `(${replaceVariable(c.def.univariateFunction.yFn, '(y)', `(${y})`)})`;
            } else {
                return `(${replaceVariable(c.def.univariateFunction.fn, '(y)', `(${y})`)})`;
            }
        }

        xyOfT(t) {
            return [
                replaceVariable(this.def.parametricFunction.xFunction, '(t)', `(${t})`),
                replaceVariable(this.def.parametricFunction.yFunction, '(t)', `(${t})`)
            ];
        }

        // ============================================================
        // [UNCHANGED] Parsing logic for points and calculation
        // ============================================================
        parseSelf(parsedData) {
            let c = this;
            parsedData = super.parseSelf(parsedData);
            parsedData.calcs[c.name] = parsedData.calcs[c.name] || {};
            c.pts.forEach(function (p) {
                if (p.hasOwnProperty('x')) {
                    parsedData.calcs[c.name][p['name']] = {
                        x: p['x'],
                        y: c.yOfX(p['x'])
                    };
                }
                if (p.hasOwnProperty('y')) {
                    parsedData.calcs[c.name][p['name']] = {
                        x: c.xOfY(p['y']),
                        y: p['y']
                    };
                }
            });
            return parsedData;
        }
    }
}

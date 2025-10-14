/// <reference path='../../kg.ts' />

module KG {

    // ============================================================
    // Visualization and dynamic control options
    // ============================================================
    export interface AnimationODEOptions {
        showDots?: boolean;
        dotRadius?: number;
        dotColor?: string;
        movingDotRadius?: number;
        movingDotColor?: string;
        speed?: number;
        animation?: boolean;
        restartDelay?: number;   // Time (ms) before restarting after an update
    }

    // ============================================================
    // Main class — controls dots and animation
    // ============================================================
    export class AnimationODE {

        private _active: boolean = false;
        private _handle: number | null = null;
        private _paused: boolean = false;
        private _restartTimeout: any = null;  // Controls pending timeout

        constructor() {}

        // ============================================================
        // 1. Complete update (called by Curve)
        // ============================================================
        update(curve: any, fn: any) {
            if (!fn || !curve) return;

            // Generate data and dots if necessary
            if (typeof fn.generateData === 'function') {
                fn.generateData();
            }
            if (fn.showDots && typeof fn.generateDots === 'function') {
                fn.generateDots();
            }

            // Render static dots
            this.renderDots(curve, fn.dots || [], {
                showDots: fn.showDots,
                dotRadius: fn.dotRadius,
                dotColor: fn.dotColor
            });

            // Cancel previous animation and pending timeout
            this.stop();
            if (this._restartTimeout) {
                clearTimeout(this._restartTimeout);
                this._restartTimeout = null;
            }

            // Check if animation should start
            if (this.isAnimationOn(fn)) {
                const delay = fn.restartDelay || 1000; // Default 1s delay

                // Schedule animation restart
                this._restartTimeout = setTimeout(() => {
                    this._restartTimeout = null;
                    if (this._active) return; // Prevent double start
                    this.start(curve, fn.data || [], {
                        animation: fn.animation,
                        speed: fn.speed,
                        movingDotColor: fn.movingDotColor,
                        movingDotRadius: fn.movingDotRadius
                    });
                }, delay);
            }
        }

        // ============================================================
        // 2. Render static dots
        // ============================================================
        private renderDots(
            curve: any,
            data: { x: number; y: number }[] = [],
            opts: AnimationODEOptions
        ) {
            if (!opts.showDots || !data.length) return;

            const group = curve.rootElement.select('.ode-dots-group');
            const dots = (group as any)
                .selectAll('circle.ode-dot')
                .data(data as any);

            dots.enter()
                .append('circle')
                .attr('class', 'ode-dot')
                .attr('r', opts.dotRadius || 3)
                .merge(dots)
                .attr('cx', (d: any) => curve.xScale.scale(d.x))
                .attr('cy', (d: any) => curve.yScale.scale(d.y))
                .style('fill', opts.dotColor || 'green')
                .style('pointer-events', 'none');

            dots.exit().remove();
        }

        // ============================================================
        // 3. Start the moving dot animation (real-time control)
        // ============================================================
        private start(
            curve: any,
            data: { x: number; y: number }[] = [],
            opts: AnimationODEOptions
        ) {
            this.stop(); // Restart
            if (!opts.animation || !data.length) return;

            this._active = true;

            const total = data.length;
            const speed = opts.speed || 1;
            const color = opts.movingDotColor || 'red';
            const radius = opts.movingDotRadius || 5;

            // Create or reuse the moving dot
            let dot = curve.rootElement.select('.moving-dot');
            if (dot.empty()) {
                dot = curve.rootElement
                    .append('circle')
                    .attr('class', 'moving-dot')
                    .attr('r', radius)
                    .style('fill', color)
                    .style('pointer-events', 'none');
            }

            let frame = 0;
            let lastTime = performance.now();

            const animate = (time: number) => {
                if (!this._active || !data.length) return;

                // Time difference between frames (ms)
                const delta = (time - lastTime) / (1000 / 60); // Normalize to "equivalent frames"
                lastTime = time;

                // Advance proportionally to real time
                frame = (frame + speed * delta) % total;
                const idx = Math.floor(frame);
                const p = data[idx] || data[0];

                dot.attr('cx', curve.xScale.scale(p.x))
                   .attr('cy', curve.yScale.scale(p.y));

                this._handle = requestAnimationFrame(animate);
            };

            this._handle = requestAnimationFrame(animate);
        }

        // ============================================================
        // 4. Stop animation and remove the moving dot
        // ============================================================
        stop() {
            if (!this._active && !this._handle) return;
            this._active = false;
            if (this._handle) cancelAnimationFrame(this._handle);
            this._handle = null;

            // Remove moving dot
            d3.selectAll('.moving-dot').remove();
        }

        // ============================================================
        // 5. Pause and resume control
        // ============================================================
        pause() {
            if (this._active) {
                this._paused = true;
                this.stop();
            }
        }

        resume(curve: any, data: { x: number; y: number }[], opts: AnimationODEOptions) {
            if (this._paused) {
                this._paused = false;
                this.start(curve, data, opts);
            }
        }

        // ============================================================
        // 6. Helper: check if animation should be active
        // ============================================================
        private isAnimationOn(fn: any): boolean {
            let val: any = undefined;

            // Try reading the 'animation' parameter from the model
            if (fn && fn.model && fn.model.currentParamValues) {
                val = fn.model.currentParamValues.animation;
            }

            // If not found, try to evaluate expression
            if (val === undefined && fn && typeof fn.evaluateExpr === 'function') {
                val = fn.evaluateExpr(fn.animation, fn.model);
            }

            return (val === true || val === 'true' || val === 1 || val === '1');
        }

        // ============================================================
        // 7. Current state
        // ============================================================
        isActive() {
            return this._active;
        }
    }
}

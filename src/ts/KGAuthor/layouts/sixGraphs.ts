/// <reference path="../kgAuthor.ts" />

module KGAuthor {

    export class SixGraphs extends SquareLayout {

        constructor(def) {
            super(def);

            const l = this;
            let topLeftGraphDef = def['topLeftGraph'],
                bottomLeftGraphDef = def['bottomLeftGraph'],
                middleLeftGraphDef = def['middleLeftGraph'],
                topRightGraphDef = def['topRightGraph'],
                middleRightGraphDef = def['middleRightGraph'],
                bottomRightGraphDef = def['bottomRightGraph'];

            const leftX = 0.075, rightX = 0.575, topY = 0.025, middleY = 0.35, bottomY = 0.675;

            topLeftGraphDef.position = {
                "x": leftX,
                "y": topY,
                "width": 0.4,
                "height": 0.28
            };
            middleLeftGraphDef.position = {
                "x": leftX,
                "y": middleY,
                "width": 0.4,
                "height": 0.28
            };
            bottomLeftGraphDef.position = {
                "x": leftX,
                "y": bottomY,
                "width": 0.4,
                "height": 0.28
            };

            topRightGraphDef.position = {
                "x": rightX,
                "y": topY,
                "width": 0.4,
                "height": 0.28
            };
            middleRightGraphDef.position = {
                "x": rightX,
                "y": middleY,
                "width": 0.4,
                "height": 0.28
            };
            bottomRightGraphDef.position = {
                "x": rightX,
                "y": bottomY,
                "width": 0.4,
                "height": 0.28
            };

            l.subObjects.push(new Graph(topLeftGraphDef));
            l.subObjects.push(new Graph(middleLeftGraphDef));
            l.subObjects.push(new Graph(bottomLeftGraphDef));
            l.subObjects.push(new Graph(topRightGraphDef));
            l.subObjects.push(new Graph(middleRightGraphDef));
            l.subObjects.push(new Graph(bottomRightGraphDef));


        }

    }

    export class SixGraphsPlusSidebar extends SixGraphs {

        constructor(def) {
            super(def);

            const l = this;
            let sidebarDef = def['sidebar'];

            l.subObjects.push(new Sidebar(sidebarDef))


        }

    }


}




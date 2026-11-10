// Editor types for the p5 global-mode API used by sketch.js.
// The implementations are loaded from library/p5.min.js by index.html.
interface P5SketchCanvas {
  elt: HTMLCanvasElement;
  parent(id: string): void;
}

interface P5SketchColor {
  levels: number[];
}

type P5SketchPaint = string | P5SketchColor;

declare const width: number;
declare const mouseX: number;
declare const mouseY: number;
declare const LEFT: 'left';
declare const RIGHT: 'right';
declare const CENTER: 'center';
declare const NORMAL: 'normal';
declare const CLOSE: 'close';

declare function createCanvas(width: number, height: number): P5SketchCanvas;
declare function resizeCanvas(width: number, height: number): void;
declare function redraw(): void;
declare function noLoop(): void;

declare function background(value: P5SketchPaint): void;
declare function fill(value: P5SketchPaint): void;
declare function fill(gray: number, alpha?: number): void;
declare function fill(red: number, green: number, blue: number, alpha?: number): void;
declare function noFill(): void;
declare function stroke(value: P5SketchPaint): void;
declare function noStroke(): void;
declare function strokeWeight(weight: number): void;
declare function color(value: string): P5SketchColor;
declare function lerpColor(from: P5SketchColor, to: P5SketchColor, amount: number): P5SketchColor;

declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function rect(x: number, y: number, width: number, height: number, radius?: number): void;
declare function circle(x: number, y: number, diameter: number): void;
declare function beginShape(): void;
declare function vertex(x: number, y: number): void;
declare function endShape(mode?: typeof CLOSE): void;

declare function text(value: string | number, x: number, y: number, maxWidth?: number, maxHeight?: number): void;
declare function textAlign(align: typeof LEFT | typeof RIGHT | typeof CENTER): void;
declare function textSize(size: number): void;
declare function textStyle(style: typeof NORMAL): void;
declare function textLeading(leading: number): void;
declare function textWidth(value: string): number;

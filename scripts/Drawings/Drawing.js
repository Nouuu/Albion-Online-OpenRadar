export class Drawing {

    constructor() {


    }

    drawFilledCircle(context, x, y, radius, color) {
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
    }

    lerp(a, b, t) {
    return a + (b - a) * t;
    }


}
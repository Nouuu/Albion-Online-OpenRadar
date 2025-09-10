class DrawingUtils
{
    constructor(settings)
    {
        this.settings = settings;
        this.fontSize = "12px";
        this.fontFamily = "Arial";
        this.textColor = "white";
        this.images = [];
    }

    InitOurPlayerCanvas(ourPlayerCanvas, context)
    {
        this.drawFilledCircle(context, ourPlayerCanvas.width/2, ourPlayerCanvas.height/2, 10, "blue");
    }
        
    initGridCanvas(canvasBottom, contextBottom)
    {    
        //this.fillCtx(canvasBottom, contextBottom);
        this.drawBoard(canvasBottom, contextBottom);
    }

    drawFilledCircle(context, x, y, radius, color)
    {
        context.beginPath();
        context.arc(x , y , radius, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.fill();
    }
    
    initCanvas(canvas, context) {}

    fillCtx(canvasBottom, contextBottom)
    {
        contextBottom.fillStyle = '#1a1c23';
        contextBottom.fillRect(0, 0, canvasBottom.width, canvasBottom.height);
        //this.drawFilledCircle(contextBottom, canvasBottom.width / 2, canvasBottom.height / 2, 10, "blue"); 
    }

    drawBoard(canvasBottom, contextBottom)
    {
        var bw = canvasBottom.width;
        var bh = canvasBottom.height;

        var p = 0;
        let totalSpace = canvasBottom.height / 10;

        for (var x = 0; x <= bw; x += totalSpace)
        {
            contextBottom.moveTo(0.5 + x + p, p);
            contextBottom.lineTo(0.5 + x + p, bh + p);
        }

        for (var x = 0; x <= bh; x += 50)
        {
            contextBottom.moveTo(p, 0.5 + x + p);
            contextBottom.lineTo(bw + p, 0.5 + x + p);
        }

        contextBottom.strokeStyle = "grey";
        contextBottom.stroke();
    }

    lerp(a, b, t) { return a + (b - a) * t; }


    DrawCustomImage(ctx, x, y, imageName, folder, size)
    {
        if (imageName == "" || imageName === undefined)
            return;
        
        const folderR = folder == "" || folder === undefined ? "" : folder + "/";

        const src = "/images/" + folderR + imageName + ".png"; 

        const preloadedImage = this.settings.GetPreloadedImage(src, folder);

        if (preloadedImage === null) 
        {
            this.drawFilledCircle(ctx, x, y, 10, "#4169E1");
            return;
        }

        if (preloadedImage)
        {
            ctx.drawImage(preloadedImage, x - size / 2, y - size / 2, size, size);
        }
        else
        {
            this.settings.preloadImageAndAddToList(src, folder)
            .then(() => console.log('Item loaded'))
            .catch(() => console.log('Item not loaded'));
        }
    }

    transformPoint(x, y)
    {
        //const angle = -0.7071;
        const angle = -0.785398;
        

        let newX = x * angle - y * angle;
        let newY = x * angle + y * angle;
        newX *= 4;
        newY *= 4;

        newX += 250;
        newY += 250;

        return { x: newX, y: newY };
    }


    drawText(xTemp, yTemp, text, ctx )
    {
        ctx.font = this.fontSize + " " + this.fontFamily;
        ctx.fillStyle = this.textColor;

        let x = xTemp;
        let y = yTemp;

        const textWidth = ctx.measureText(text).width;

        ctx.fillText(text, x - textWidth / 2, y);
    }


    drawTextItems(xTemp, yTemp, text, ctx , size , color)
    {
        ctx.font = size + " " + this.fontFamily;
        ctx.fillStyle = color;

        let x = xTemp;
        let y = yTemp;

        ctx.fillText(text, x , y);
    }
}

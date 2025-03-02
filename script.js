const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const particles = [];
let totalEaten = 0;
let totalLost = 0;
let hue = 0;
let apple = undefined;

window.addEventListener('resize', function() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const mouse = {
    x: null,
    y: null,
};

canvas.addEventListener('click', function(event) {
    mouse.x = event.x;
    mouse.y = event.y;

    for (let i = 0; i < 50; i++) {
        particles.push(new Particle());
    }
});

canvas.addEventListener('mousemove', function(event) {
    mouse.x = event.x;
    mouse.y = event.y;

    if (particles.length < totalEaten ) particles.push(new Particle());
});

document.addEventListener('wheel', function(event) {
    hue += event.deltaY * 0.1;
    if(hue > 360) hue = 0;
    if(hue < 0) hue = 360;
});

class Particle {
    constructor(x = mouse.x,y = mouse.y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 1;
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 3 - 1.5;
        this.color = hue;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if(this.size > 0.2) this.size -= 0.1;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function handleParticles() {
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        if (particles[i].size <= 0.3) {
            particles.splice(i, 1);
            i--;
        }

        for (let j = i; j < particles.length; j++) {
            if(!particles[i] || !particles[j]) continue;
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
                ctx.beginPath();
                ctx.strokeStyle = particles[i].color;
                ctx.lineWidth = 0.2;
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
                ctx.closePath();
            }
        }
    }
}

function showTotalEaten() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Verdana';
    ctx.fillText(`Eaten: ${totalEaten}; Lost: ${totalLost}`, 10, 50);
    ctx.fillStyle = 'white';
    ctx.fillText(`Click to create firework`, 10, 70);
}

function handleApple() {    
    if(!apple) {
        apple = new Apple();
        hue = apple.color;
    }
    if(apple?.isEaten()) {
        totalEaten++;
        apple = undefined;
    }

    if(apple?.size <= 0.3) {
        apple.explode();
        totalLost++;
        apple = undefined
    }

    apple?.update();
    apple?.draw();
}


const animate = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handleParticles();
    handleApple();
    showTotalEaten();
    requestAnimationFrame(animate);
}

class Apple {
    constructor() {
        const oldX = apple?.x || Math.random() * canvas.width;
        const oldY = apple?.y || Math.random() * canvas.height;
        let oldPart = Math.floor(oldX / (canvas.width / 2)) + Math.floor(oldY / (canvas.height / 2));
        let newPart = (oldPart + 2) % 4;
        let newX = Math.random() * (canvas.width / 2) + (newPart % 2) * (canvas.width / 2);
        let newY = Math.random() * (canvas.height / 2) + Math.floor(newPart / 2) * (canvas.height / 2);
        this.x = newX;
        this.y = newY;
        this.size = 20;
        this.color = `hsl(${Math.random()*360}, 100%, 50%)`;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }

    update() {
        this.size -= 0.1;
    }

    isEaten() {
        return mouse.x >= this.x - this.size && mouse.x <= this.x + this.size && mouse.y >= this.y - this.size && mouse.y <= this.y + this.size;
    }

    explode() {
        if(this.size <= 0.3) {
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(this.x, this.y));
            }
        }
    }
}

animate();
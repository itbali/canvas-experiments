class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
    }

    emit(event, ...args) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(...args));
        }
    }
}

class GameState {
    constructor() {
        this.particles = [];
        this.score = { eaten: 0, lost: 0 };
        this.apple = null;
        this.hue = 0;
        this.isPaused = false;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mouse = { x: null, y: null };
    }

    updateSize(width, height) {
        this.width = width;
        this.height = height;
    }
}

const GRID_SIZE = 100;
const MAX_PARTICLES = 5000;
const TEXT_PADDING = 20;
const TEXT_HEIGHT = 60;

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const gameState = new GameState();
const eventBus = new EventEmitter();
const spatialGrid = new Map();

canvas.width = gameState.width;
canvas.height = gameState.height;

class Particle {
    constructor() {
        this.reset();
    }

    reset(x = gameState.mouse.x, y = gameState.mouse.y) {
        this.x = x;
        this.y = y;
        this.prevX = this.x;
        this.prevY = this.y;
        this.size = Math.random() * 5 + 1;
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 3 - 1.5;
        this.color = `hsl(${gameState.hue}, 100%, 50%)`;
        this.ax = 0;
        this.ay = 0.1;
    }

    update(dt) {
        const velocityX = (this.x - this.prevX) * 0.98;
        const velocityY = (this.y - this.prevY) * 0.98;
        
        this.prevX = this.x;
        this.prevY = this.y;
        
        this.x += velocityX + this.speedX;
        this.y += velocityY + this.speedY;
        
        if(this.size > 0.2) this.size -= 0.1;

        if (this.x < 0 || this.x > gameState.width || 
            this.y < 0 || this.y > gameState.height) {
            this.size = 0.2;
        }
    }

    draw(ctx, renderStrategy = 'basic') {
        renderStrategies[renderStrategy](ctx, this);
    }
}

class ParticlePool {
    constructor(maxSize = 5000) {
        this.particles = Array(maxSize).fill().map(() => new Particle());
        this.index = 0;
    }

    get(x, y) {
        const particle = this.particles[this.index];
        this.index = (this.index + 1) % this.particles.length;
        particle.reset(x, y);
        return particle;
    }
}

const particlePool = new ParticlePool(MAX_PARTICLES);

window.addEventListener('resize', function() {
    gameState.updateSize(window.innerWidth, window.innerHeight);
    canvas.width = gameState.width;
    canvas.height = gameState.height;
});

canvas.addEventListener('click', function(event) {
    gameState.mouse.x = event.x;
    gameState.mouse.y = event.y;
    eventBus.emit('particle:create', { count: 50, x: event.x, y: event.y });
});

canvas.addEventListener('mousemove', function(event) {
    gameState.mouse.x = event.x;
    gameState.mouse.y = event.y;
    
    if (gameState.particles.length < gameState.score.eaten) {
        eventBus.emit('particle:create', { count: 1, x: event.x, y: event.y });
    }
});

document.addEventListener('wheel', function(event) {
    gameState.hue += event.deltaY * 0.1;
    if(gameState.hue > 360) gameState.hue = 0;
    if(gameState.hue < 0) gameState.hue = 360;
});

const renderStrategies = {
    basic: (ctx, particle) => {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    },
    glow: (ctx, particle) => {
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
};

function updateSpatialGrid() {
    spatialGrid.clear();
    gameState.particles.forEach(particle => {
        const gridX = Math.floor(particle.x / GRID_SIZE);
        const gridY = Math.floor(particle.y / GRID_SIZE);
        const key = `${gridX},${gridY}`;
        if (!spatialGrid.has(key)) spatialGrid.set(key, []);
        spatialGrid.get(key).push(particle);
    });
}

function checkCollision(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 100;
}

function drawConnectionLine(p1, p2) {
    ctx.beginPath();
    ctx.strokeStyle = p1.color;
    ctx.lineWidth = 0.2;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();
}

const metrics = {
    frameTimes: [],
    particlesCount: [],
    startTime: performance.now(),
    frameStart: 0,
    
    startFrame() {
        this.frameStart = performance.now();
    },
    
    endFrame() {
        const frameTime = performance.now() - this.frameStart;
        this.frameTimes.push(frameTime);
        this.particlesCount.push(gameState.particles.length);
        
        if (this.frameTimes.length > 120) {
            this.frameTimes.shift();
            this.particlesCount.shift();
        }
    },
    
    getFPS() {
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        return Math.round(1000 / avg);
    },
    
    getAverageParticles() {
        return Math.round(
            this.particlesCount.reduce((a, b) => a + b, 0) / this.particlesCount.length
        );
    }
};

eventBus.on('particle:create', ({ count, x, y }) => {
    for (let i = 0; i < count; i++) {
        const particle = particlePool.get(x, y);
        gameState.particles.push(particle);
    }
});

function handleParticles() {
    updateSpatialGrid();
    const remainingParticles = [];

    for (const particle of gameState.particles) {
        particle.update(1/60);
        particle.draw(ctx, 'glow');

        if (particle.size > 0.3) {
            remainingParticles.push(particle);
        }
    }

    gameState.particles = remainingParticles;

    spatialGrid.forEach((cellParticles) => {
        for (let i = 0; i < cellParticles.length; i++) {
            for (let j = i + 1; j < cellParticles.length; j++) {
                if (checkCollision(cellParticles[i], cellParticles[j])) {
                    drawConnectionLine(cellParticles[i], cellParticles[j]);
                }
            }
        }
    });
}

function showGameInfo() {
    ctx.font = '20px Verdana';
    
    const text1 = `Eaten: ${gameState.score.eaten}; Lost: ${gameState.score.lost}`;
    const text2 = `Click to create firework`;
    const fps = `FPS: ${metrics.getFPS()}`;
    const particles = `Particles: ${metrics.getAverageParticles()}`;
    
    const metricsText1 = ctx.measureText(text1);
    const metricsText2 = ctx.measureText(text2);
    const metricsFps = ctx.measureText(fps);
    const metricsParticles = ctx.measureText(particles);
    
    const text1X = canvas.width - metricsText1.width - TEXT_PADDING;
    const text2X = canvas.width - metricsText2.width - TEXT_PADDING;
    const fpsX = canvas.width - metricsFps.width - TEXT_PADDING;
    const particlesX = canvas.width - metricsParticles.width - TEXT_PADDING;
    
    const text1Y = canvas.height - TEXT_PADDING*4;
    const text2Y = canvas.height - TEXT_PADDING*3;
    const fpsY = canvas.height - TEXT_PADDING*2;
    const particlesY = canvas.height - TEXT_PADDING;

    ctx.strokeStyle = gameState.apple?.color || 'black';
    ctx.lineWidth = 1;
    
    [
        [text1, text1X, text1Y],
        [text2, text2X, text2Y],
        [fps, fpsX, fpsY],
        [particles, particlesX, particlesY]
    ].forEach(([text, x, y]) => {
        ctx.strokeText(text, x, y);
        ctx.fillStyle = 'white';
        ctx.fillText(text, x, y);
    });
}

class Apple {
    constructor() {
        const oldX = gameState.apple?.x || Math.random() * canvas.width;
        const oldY = gameState.apple?.y || Math.random() * canvas.height;
        let oldPart = Math.floor(oldX / (canvas.width / 2)) + Math.floor(oldY / (canvas.height / 2));
        let newPart = (oldPart + 2) % 4;
        let newX, newY;
        
        do {
            newX = Math.random() * (canvas.width / 2) + (newPart % 2) * (canvas.width / 2);
            newY = Math.random() * (canvas.height / 2) + Math.floor(newPart / 2) * (canvas.height / 2);
        } while (
            newX > canvas.width - 300 && 
            newY > canvas.height - TEXT_HEIGHT
        );

        this.x = newX;
        this.y = newY;
        this.size = 20;
        this.color = `hsl(${Math.random()*360}, 100%, 50%)`;
    }

    draw(ctx) {
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
        const dx = gameState.mouse.x - this.x;
        const dy = gameState.mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.size;
    }

    explode() {
        if(this.size <= 0.3) {
            for (let i = 0; i < 50; i++) {
                const particle = particlePool.get(this.x, this.y);
                gameState.particles.push(particle);
            }
        }
    }
}

function handleApple() {    
    if(!gameState.apple) {
        gameState.apple = new Apple();
        gameState.hue = parseInt(gameState.apple.color.match(/\d+/)[0]);
        return;
    }

    if(gameState.apple.isEaten()) {
        gameState.score.eaten++;
        gameState.apple = undefined;
        return;
    }

    if(gameState.apple.size <= 0.3) {
        if(gameState.apple.size > 0) {
            gameState.apple.explode();
            gameState.score.lost++;
        }
        gameState.apple = undefined;
        return;
    }

    gameState.apple.update();
    gameState.apple.draw(ctx);
}

const animate = function() {
    metrics.startFrame();
    
    if (!gameState.isPaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleParticles();
        handleApple();
        showGameInfo();
    }
    
    metrics.endFrame();
    requestAnimationFrame(animate);
};

animate();
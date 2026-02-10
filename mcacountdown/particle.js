// particle-effect-library.js

(function() {
    // Hardcoded particle properties
    const HARDCODED_PARTICLE_COUNT = 500; // Max particles for default mode, image density will vary
    const HARDCODED_PARTICLE_SIZE = 2;
    const HARDCODED_PARTICLE_SPEED = 2.3;
    const HARDCODED_INTERACTION_RADIUS = 200;
    const HARDCODED_INTERACTION_STRENGTH = 0.1;
    const DEFAULT_PARTICLE_COLOR = "#63b3ed"; // Fallback color for non-image particles

    /**
     * Represents a single particle in the system.
     */
    class Particle {
        constructor(x, y, size, color, speed) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
            // Initial random velocity components
            this.velocity = {
                x: (Math.random() - 0.5) * speed,
                y: (Math.random() - 0.5) * speed
            };
            this.baseX = x; // Original X position (for image mode gravity)
            this.baseY = y; // Original Y position (for image mode gravity)
        }

        /**
         * Draws the particle on the canvas context.
         * @param {CanvasRenderingContext2D} ctx - The 2D rendering context of the canvas.
         */
        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        /**
         * Updates the particle's position and velocity based on forces and interactions.
         * @param {object} mouse - The mouse/touch position {x, y}.
         * @param {boolean} isImageMode - True if currently displaying an image.
         * @param {HTMLCanvasElement} canvas - The canvas element.
         */
        update(mouse, isImageMode, canvas) {
            // Apply "gravity" effect only if in image mode
            if (isImageMode) {
                const returnSpeed = 0.02; // Slower pull for gradual return
                const damping = 0.92;    // Less oscillation, but still some bounce

                const dxToTarget = this.baseX - this.x;
                const dyToTarget = this.baseY - this.y;

                this.velocity.x += dxToTarget * returnSpeed;
                this.velocity.y += dyToTarget * returnSpeed;

                // Dampen velocity for smooth return and prevent overshooting too much
                this.velocity.x *= damping;
                this.velocity.y *= damping;
            } else {
                // Default mode (no image): particles drift and bounce off walls
                if (this.x + this.size > canvas.width || this.x - this.size < 0) {
                    this.velocity.x *= -1;
                }
                if (this.y + this.size > canvas.height || this.y - this.size < 0) {
                    this.velocity.y *= -1;
                }
            }

            // Apply current velocity to position
            this.x += this.velocity.x;
            this.y += this.velocity.y;

            // Mouse/Touch interaction (repel with ripple effect)
            if (mouse.x !== undefined && mouse.y !== undefined) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Define a larger area where the mouse has an effect for the ripple
                const maxInfluenceRadius = HARDCODED_INTERACTION_RADIUS * 2.5;

                if (distance < maxInfluenceRadius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;

                    // Calculate force that diminishes with distance, creating a ripple effect
                    // Force is strongest near mouse, falls off to 0 at maxInfluenceRadius
                    const normalizedDistance = distance / maxInfluenceRadius;
                    const forceMagnitude = (1 - normalizedDistance) * HARDCODED_INTERACTION_STRENGTH * 10; // Multiplied for stronger initial ripple

                    this.velocity.x += forceDirectionX * forceMagnitude;
                    this.velocity.y += forceDirectionY * forceMagnitude;
                }
            }

            // Draw the particle after updating its position
            this.draw(canvas.getContext('2d'));
        }
    }

    /**
     * Manages the particle effect for a given image element.
     */
    class ParticleEffectManager {
        /**
         * @param {HTMLImageElement} imgElement - The <img> element to apply the effect to.
         */
        constructor(imgElement) {
            this.imgElement = imgElement;
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.particles = [];
            this.isImageMode = false; // Will be true once an image is successfully loaded
            this.mouse = { x: undefined, y: undefined };
            this.animationFrameId = null; // To store the ID of requestAnimationFrame
            this.imageData = null; // To store image data for resizing/re-initialization

            this.init();
        }

        /**
         * Initializes the particle effect by setting up the canvas, loading the image,
         * and attaching event listeners.
         */
        init() {
            // Create a container for the image and canvas to maintain layout space
            this.container = document.createElement('div');
            this.container.style.position = 'relative';
            this.container.style.display = 'inline-block'; // Or 'block' depending on img display
            this.container.style.width = this.imgElement.offsetWidth + 'px';
            this.container.style.height = this.imgElement.offsetHeight + 'px';

            // Insert container before the image and move image into it
            this.imgElement.parentNode.insertBefore(this.container, this.imgElement);
            this.container.appendChild(this.imgElement);

            // Create canvas element
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');

            // Set canvas dimensions to match the image's rendered size
            this.canvas.width = this.imgElement.offsetWidth;
            this.canvas.height = this.imgElement.offsetHeight;

            // Position canvas absolutely over the image
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.touchAction = 'none'; // Prevent default touch actions like scrolling/zooming
            this.canvas.style.borderRadius = '0.5rem'; // Match original styling
            this.canvas.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'; // Match original styling
            this.canvas.style.backgroundColor = '#000000'; // Match original styling

            // Append canvas to the container
            this.container.appendChild(this.canvas);

            // Hide the original image element
            this.imgElement.style.display = 'none';

            // Attach event listeners for mouse/touch interaction and window resizing
            this.addEventListeners();

            // Load the image and initialize particles from its data
            this.loadImageAndInitParticles();

            // Start the animation loop
            this.animate();
        }

        /**
         * Attaches necessary event listeners to the canvas and window.
         */
        addEventListeners() {
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
            this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
            window.addEventListener('resize', this.handleResize.bind(this));
        }

        handleMouseMove(e) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        }

        handleTouchMove(e) {
            e.preventDefault(); // Prevent default touch actions (e.g., scrolling)
            const rect = this.canvas.getBoundingClientRect();
            if (e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX - rect.left;
                this.mouse.y = e.touches[0].clientY - rect.top;
            }
        }

        handleMouseLeave() {
            this.mouse.x = undefined;
            this.mouse.y = undefined;
        }

        handleTouchEnd() {
            this.mouse.x = undefined;
            this.mouse.y = undefined;
        }

        /**
         * Handles window resizing by re-adjusting canvas dimensions and re-initializing particles.
         */
        handleResize() {
            // Update container and canvas size based on original image's current rendered dimensions
            // This assumes the imgElement itself is responsive or its parent controls its size.
            const currentImgWidth = this.imgElement.offsetWidth;
            const currentImgHeight = this.imgElement.offsetHeight;

            this.container.style.width = currentImgWidth + 'px';
            this.container.style.height = currentImgHeight + 'px';
            this.canvas.width = currentImgWidth;
            this.canvas.height = currentImgHeight;

            // Re-initialize particles if image data exists (meaning an image was successfully loaded)
            if (this.imageData) {
                 this.initImageParticles(this.imageData);
            } else {
                // Fallback to default particles if image failed to load or not yet processed
                this.initDefaultParticles();
            }
        }

        /**
         * Loads the source image and extracts pixel data to initialize particles.
         */
        loadImageAndInitParticles() {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Important for loading images from different origins due to CORS
            img.onload = () => {
                // Create a temporary, off-screen canvas to get pixel data from the image
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);

                // Store the raw image data for potential re-initialization on resize
                this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                this.initImageParticles(this.imageData);
            };
            img.onerror = () => {
                console.error("Particle Effect: Error loading image for particle effect:", this.imgElement.src);
                // Fallback to default particles if image loading fails
                this.initDefaultParticles();
            };
            img.src = this.imgElement.src; // Set the source from the original <img> element
        }

        /**
         * Initializes particles in a default, non-image-bound, random drifting mode.
         * This serves as a fallback or initial state.
         */
        initDefaultParticles() {
            this.isImageMode = false;
            this.particles = []; // Clear any existing particles
            for (let i = 0; i < HARDCODED_PARTICLE_COUNT; i++) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                this.particles.push(new Particle(x, y, HARDCODED_PARTICLE_SIZE, DEFAULT_PARTICLE_COLOR, HARDCODED_PARTICLE_SPEED));
            }
        }

        /**
         * Initializes particles based on the pixel data of an image.
         * @param {ImageData} imageData - The ImageData object containing pixel data.
         */
        initImageParticles(imageData) {
            this.isImageMode = true;
            this.particles = []; // Clear any existing particles
            const imageWidth = imageData.width;
            const imageHeight = imageData.height;
            const data = imageData.data; // Raw pixel data (RGBA, RGBA, ...)

            // Calculate scaling to fit the image within the canvas while maintaining aspect ratio
            const scaleX = this.canvas.width / imageWidth;
            const scaleY = this.canvas.height / imageHeight;
            const scale = Math.min(scaleX, scaleY); // Use the smaller scale to fit entirely

            // Calculate offsets to center the image on the canvas
            const offsetX = (this.canvas.width - imageWidth * scale) / 2;
            const offsetY = (this.canvas.height - imageHeight * scale) / 2;

            // Pixel sampling density: only create a particle for every 'pixelDensity' pixel
            // This balances detail with performance. Higher value = fewer particles, better performance.
            const pixelDensity = 4;

            for (let y = 0; y < imageHeight; y += pixelDensity) {
                for (let x = 0; x < imageWidth; x += pixelDensity) {
                    const index = (y * imageWidth + x) * 4; // Calculate index for RGBA data
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const a = data[index + 3];

                    // Only create particles for non-transparent or sufficiently bright pixels
                    // This helps to form the shape of the image and avoid particles in empty areas.
                    if (a > 128 && (r + g + b) / 3 > 50) {
                        const particleX = x * scale + offsetX;
                        const particleY = y * scale + offsetY;
                        const color = `rgb(${r},${g},${b})`;
                        this.particles.push(new Particle(particleX, particleY, HARDCODED_PARTICLE_SIZE, color, HARDCODED_PARTICLE_SPEED));
                    }
                }
            }
        }

        /**
         * The main animation loop. Clears the canvas and updates/draws each particle.
         */
        animate() {
            this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the entire canvas

            this.particles.forEach(particle => {
                particle.update(this.mouse, this.isImageMode, this.canvas);
            });
        }
    }

    // Auto-initialization logic:
    // When the DOM content is fully loaded, find all <img> elements
    // with the 'data-particle-effect' attribute and create a ParticleEffectManager for each.
    document.addEventListener('DOMContentLoaded', () => {
        const imgElements = document.querySelectorAll('img[data-particle-effect]');
        imgElements.forEach(imgElement => {
            new ParticleEffectManager(imgElement);
        });
    });

})(); // End of Immediately Invoked Function Expression (IIFE) to encapsulate the code

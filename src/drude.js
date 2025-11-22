// --- ZMIENNE GLOBALNE I KONFIGURACJA GUI ---

let L_GRID_WIDTH;  
let L_GRID_HEIGHT; 
const CELL_SIZE = 15; 

let N_PARTICLES = 300; 

// Parametry fizyczne
const dt = 0.1; 
const ELECTRON_CHARGE = -1.0;
const ELECTRON_MASS = 1.0;
let TAU = 10; 

// Parametry jonów
const ION_SPRING_CONSTANT = 2.0; 
const DAMPING_FACTOR = 0.98; 
const THERMAL_NOISE_MULTIPLIER = 0.0005; // OGRANICZONE DRGANIA JONÓW
const COLLISION_ENERGY_TRANSFER = 0.5; 

// Parametry elektronów
const ELECTRON_INITIAL_SPEED = 3.0; 
const ELECTRON_THERMAL_NOISE = 0.05; 
let E_FIELD_X = 0.0; 
let E_FIELD_Y = 0.0;

let electrons = [];
let ions = [];
let average_drift_velocity = 0;

// ZMIANA: Zmienne do śledzenia liczby elektronów i ustawienia układu
let electrons_left_side = 0;
let electrons_right_side = 0;
const BOUNDARY_RATIO = 0.5; 

// ZMIENNE DO STEROWANIA OBSZAREM WIZUALIZACJI
let SIM_AREA_START_X;
let SIM_AREA_START_Y;
let SIM_AREA_WIDTH;
let SIM_AREA_HEIGHT;
const GUI_TOP_HEIGHT = 50; 
const GUI_BOTTOM_HEIGHT = 150; // Nowe miejsce na GUI na dole

// Elementy GUI
let eFieldSlider;
let tempSlider;
let particleCountInput;
let textEField;
let textTemp;


// --- KLASA ION (Bez zmian) ---

class Ion {
    constructor(x, y) {
        this.x_init = x; 
        this.y_init = y;
        this.x_current = x; 
        this.y_current = y;
        this.vx_thermal = 0;
        this.vy_thermal = 0;
    }

    update() {
        this.vx_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        this.vy_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        
        const dx = this.x_current - this.x_init;
        const dy = this.y_current - this.y_init;
        const ax = -ION_SPRING_CONSTANT * dx;
        const ay = -ION_SPRING_CONSTANT * dy;

        this.vx_thermal += ax * dt;
        this.vy_thermal += ay * dt;
        this.vx_thermal *= DAMPING_FACTOR;
        this.vy_thermal *= DAMPING_FACTOR;

        this.x_current += this.vx_thermal * dt;
        this.y_current += this.vy_thermal * dt;
    }

    display() {
        const ION_SIZE = CELL_SIZE * 1.5; 
        fill(255, 0, 0); // ZMIANA: Czerwone jony, jak na nagraniu
        noStroke();
        
        const drawX = this.x_current * CELL_SIZE + SIM_AREA_START_X;
        const drawY = this.y_current * CELL_SIZE + SIM_AREA_START_Y;
        
        ellipse(drawX, drawY, ION_SIZE, ION_SIZE);
        
        fill(255); 
        textSize(CELL_SIZE * 1.5);
        textAlign(CENTER, CENTER);
        text('+', drawX, drawY);
    }
}


// --- KLASA ELEKTRONU ---

class Electron {
  constructor() {
    this.x = random(L_GRID_WIDTH);
    this.y = random(L_GRID_HEIGHT);
    
    const MIN_INITIAL_SPEED = 1.0; 
    const max_speed = ELECTRON_INITIAL_SPEED;

    const speed = random(MIN_INITIAL_SPEED, max_speed); 
    const angle = random(TWO_PI); 
    
    this.vx = speed * cos(angle);
    this.vy = speed * sin(angle);
  }

  update() {
    // Siła od pola E
    const Fx_E = ELECTRON_CHARGE * E_FIELD_X;
    const Fy_E = ELECTRON_CHARGE * E_FIELD_Y;

    // Człon Relaksacyjny Drudego
    const Fx_relax = -(ELECTRON_MASS / TAU) * this.vx;
    const Fy_relax = -(ELECTRON_MASS / TAU) * this.vy;

    // Przyspieszenie
    const ax = (Fx_E + Fx_relax) / ELECTRON_MASS;
    const ay = (Fy_E + Fy_relax) / ELECTRON_MASS;

    // Całkowanie
    this.vx += ax * dt;
    this.vy += ay * dt;

    // Szum Termiczny (Model Langevina)
    this.vx += random(-ELECTRON_THERMAL_NOISE, ELECTRON_THERMAL_NOISE);
    this.vy += random(-ELECTRON_THERMAL_NOISE, ELECTRON_THERMAL_NOISE);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Zderzenia
    this.checkCollision(ions);

    // Warunki brzegowe (torus)
    this.x = (this.x + L_GRID_WIDTH) % L_GRID_WIDTH;
    this.y = (this.y + L_GRID_HEIGHT) % L_GRID_HEIGHT;
  }
  
  checkCollision(ionArray) {
    const COLLISION_RADIUS_SQUARED = sq(CELL_SIZE * 1.0); 

    for (let ion of ionArray) {
      const dx = this.x * CELL_SIZE - ion.x_current * CELL_SIZE;
      const dy = this.y * CELL_SIZE - ion.y_current * CELL_SIZE;
      
      if (dx * dx + dy * dy < COLLISION_RADIUS_SQUARED) {
        
        const normal_angle = atan2(dy, dx);
        const normal_x = cos(normal_angle);
        const normal_y = sin(normal_angle);
        
        const v_normal = this.vx * normal_x + this.vy * normal_y;
        
        if (v_normal < 0) { 
            
            const v_loss = -v_normal * COLLISION_ENERGY_TRANSFER; 
            
            this.vx -= v_loss * normal_x;
            this.vy -= v_loss * normal_y;
            
            ion.vx_thermal += v_loss * normal_x * 0.5;
            ion.vy_thermal += v_loss * normal_y * 0.5;
            
            this.x += normal_x * 0.1;
            this.y += normal_y * 0.1;
            
            return;
        }
      }
    }
  }

  display() {
    const ELECTRON_SIZE = CELL_SIZE * 0.8;
    fill(0, 0, 255); // ZMIANA: Niebieskie elektrony, jak na nagraniu
    noStroke();
    
    const drawX = this.x * CELL_SIZE + SIM_AREA_START_X;
    const drawY = this.y * CELL_SIZE + SIM_AREA_START_Y;
    
    ellipse(drawX, drawY, ELECTRON_SIZE, ELECTRON_SIZE);
    
    fill(255); // Biały znak minus
    textSize(CELL_SIZE);
    textAlign(CENTER, CENTER);
    text('-', drawX, drawY);
  }
}

// --- FUNKCJE SETUP I RYSOWANIE ---

function setup() {
  createCanvas(windowWidth, windowHeight);
  defineLayout();

  initializeIons();
  initializeElectrons();

  createGUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  defineLayout(); 
  initializeIons(); 
}

// ZMIANA: Modyfikacja układu na GUI na dole, szerokie marginesy na liczniki
function defineLayout() {
  const MARGIN_X = 150; 
  const MARGIN_Y = 20;

  SIM_AREA_START_X = MARGIN_X;
  SIM_AREA_START_Y = GUI_TOP_HEIGHT + MARGIN_Y; 
  SIM_AREA_WIDTH = width - 2 * MARGIN_X;
  SIM_AREA_HEIGHT = height - GUI_TOP_HEIGHT - GUI_BOTTOM_HEIGHT; 

  if (SIM_AREA_WIDTH < 100) SIM_AREA_WIDTH = 100;
  if (SIM_AREA_HEIGHT < 100) SIM_AREA_HEIGHT = 100;

  L_GRID_WIDTH = floor(SIM_AREA_WIDTH / CELL_SIZE);
  L_GRID_HEIGHT = floor(SIM_AREA_HEIGHT / CELL_SIZE);
}

function initializeElectrons() {
  electrons = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    electrons.push(new Electron());
  }
}

function initializeIons() {
  ions = [];
  const ION_SPACING = 12; 
  for (let i = 0; i < L_GRID_WIDTH; i += ION_SPACING) {
    for (let j = 0; j < L_GRID_HEIGHT; j += ION_SPACING) {
      ions.push(new Ion(i + ION_SPACING / 2, j + ION_SPACING / 2));
    }
  }
}

function draw() {
  background(20); 
    
  // --- 1. Rysowanie Obszaru GUI (Kontroli) ---
  drawGUIArea();

  // --- 2. Rysowanie Obszaru Symulacji (Metal) ---
  
  fill(180, 50, 50); // Czerwone tło symulacji jak na nagraniu
  rect(SIM_AREA_START_X - 15, SIM_AREA_START_Y - 15, SIM_AREA_WIDTH + 30, SIM_AREA_HEIGHT + 30);
  fill(80, 80, 80); // Szary kolor metalu
  rect(SIM_AREA_START_X, SIM_AREA_START_Y, SIM_AREA_WIDTH, SIM_AREA_HEIGHT);
  
  // Aktualizacja i rysowanie Jonów
  for (let ion of ions) {
      ion.update(); 
      ion.display(); 
  }

    // Resetowanie liczników
    electrons_left_side = 0;
    electrons_right_side = 0;

  // Symulacja elektronów
  let total_vx = 0;
    const boundary_x = L_GRID_WIDTH * BOUNDARY_RATIO; // Środek logiczny

  for (let e of electrons) {
    e.update();
    e.display();
    total_vx += e.vx;
    
    // Liczenie elektronów po bokach
    if (e.x < boundary_x) {
        electrons_left_side++;
    } else {
        electrons_right_side++;
    }
  }

  // Obliczenie średniej prędkości dryfu
  average_drift_velocity = total_vx / N_PARTICLES;

  // --- 3. Wizualizacja Wyników i Statystyk ---
  drawSideInfo();
  drawEFieldIndicator();
}

// ZMIANA: Rysowanie informacji bocznych i tytułu
function drawSideInfo() {
    fill(255);
    noStroke();
    textSize(18);
    
    // Duży napis "Metal"
    textAlign(CENTER, CENTER);
    textSize(36);
    text('Metal', width / 2, SIM_AREA_START_Y - 30); 
    
    // Lewa strona
    textAlign(RIGHT, TOP);
    textSize(24);
    text('Left Side Electrons:', SIM_AREA_START_X - 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_left_side}`, SIM_AREA_START_X - 20, SIM_AREA_START_Y + 130);
    
    // Prawa strona
    textAlign(LEFT, TOP);
    textSize(24);
    text('Right Side Electrons:', SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_right_side}`, SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 130);
    
    // Wizualizacja prądu/dryfu na dole
    textAlign(LEFT, TOP);
    textSize(16);
    fill(255, 255, 0); // Kolor żółty dla dryftu
    text(
        `Average Drift Velocity: ${average_drift_velocity.toFixed(3)} [m/s]`,
        SIM_AREA_START_X,
        SIM_AREA_START_Y + SIM_AREA_HEIGHT + 30
    );
}

// ZMIANA: Przeniesienie wskaźnika E-Field na dół
function drawEFieldIndicator() {
  const cx = SIM_AREA_START_X + SIM_AREA_WIDTH - 150;
  const cy = SIM_AREA_START_Y + SIM_AREA_HEIGHT + 100; // Pozycja na dole

  stroke(255, 100, 100);
  strokeWeight(2);
  fill(255, 100, 100);
 
 // ... rysowanie strzałki (bez zmian logiki) ...
 
  const endX = cx + E_FIELD_X * 50;
  const endY = cy + E_FIELD_Y * 50;

  line(cx, cy, endX, endY);

  push();
  translate(endX, endY);
  rotate(atan2(endY - cy, endX - cx));
  triangle(0, 0, -5, 2, -5, -2);
  pop();

  noStroke();
  fill(255);
  text(`E = (${E_FIELD_X.toFixed(2)}, ${E_FIELD_Y.toFixed(2)})`, cx, cy - 10);
}


// --- FUNKCJE GUI (Przeniesione na DÓŁ) ---

function createGUI() {
  const style = `
    font-family: Arial, sans-serif;
    padding: 5px;
    margin: 5px;
    color: white;
  `;
  
  const PADDING = 10;
  let x_pos = PADDING;
  const y_start = height - GUI_BOTTOM_HEIGHT + 20; // Y-start na dole
  let y_pos = y_start;

  // --- 1. Kontrola Pola Elektrycznego ---
  
  createP('**Pole E (Vx)**').position(x_pos, y_pos).style(style);
  eFieldSlider = createSlider(-0.5, 0.5, E_FIELD_X, 0.01)
    .position(x_pos, y_pos + 40)
    .style('width', '150px')
    .input(updateEField);
  
  textEField = createP(`E_FIELD_X: ${E_FIELD_X.toFixed(2)}`).position(x_pos, y_pos + 60).style('color', 'white');
  
  x_pos += 200;
  
  // --- 2. Kontrola Temperatury (TAU) ---
  
  createP('**Relaksacja (τ)**').position(x_pos, y_pos).style(style);
  tempSlider = createSlider(5, 50, TAU, 1) 
    .position(x_pos, y_pos + 40)
    .style('width', '150px')
    .input(updateTemperature);
  
  textTemp = createP(`TAU (τ): ${TAU}`).position(x_pos, y_pos + 60).style('color', 'white');

  x_pos += 200;

  // --- 3. Kontrola Liczby Elektronów ---
  
  createP('**Liczba Elektronów**').position(x_pos, y_pos).style(style);
  particleCountInput = createInput(N_PARTICLES.toString(), 'number')
    .position(x_pos, y_pos + 40)
    .style('width', '100px')
    .style('background', '#333')
    .style('color', 'white')
    .style(style);

  x_pos += 150;

  createButton('Zastosuj').position(x_pos, y_pos + 40).mousePressed(updateParticleCount).style(style);
}

function drawGUIArea() {
  // Tło dla górnego panelu (mniejsze)
  fill(30, 30, 30);
  rect(0, 0, width, GUI_TOP_HEIGHT);
    
  // Tło dla dolnego panelu GUI
  rect(0, height - GUI_BOTTOM_HEIGHT, width, GUI_BOTTOM_HEIGHT);
  
  // Aktualizacja tekstu GUI
  textEField.html(`E_FIELD_X: ${E_FIELD_X.toFixed(2)}`);
  textTemp.html(`TAU (τ): ${TAU}`);
}

function updateEField() {
  E_FIELD_X = eFieldSlider.value();
}

function updateTemperature() {
  TAU = tempSlider.value();
}

function updateParticleCount() {
  const newCount = parseInt(particleCountInput.value());
  if (!isNaN(newCount) && newCount > 0 && newCount <= 500) { 
    N_PARTICLES = newCount;
    initializeElectrons(); 
  } else {
    alert('Wprowadź liczbę od 1 do 500.');
    particleCountInput.value(N_PARTICLES); 
  }
}
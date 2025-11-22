// --- ZMIENNE GLOBALNE I KONFIGURACJA GUI ---

let L_GRID_WIDTH;  // Szerokość siatki w jednostkach symulacji
let L_GRID_HEIGHT; // Wysokość siatki w jednostkach symulacji
const CELL_SIZE = 15; // Rozmiar komórki na ekranie

let N_PARTICLES = 300; // Liczba symulowanych elektronów

// Parametry fizyczne
const dt = 0.1; // Krok czasowy całkowania
const ELECTRON_CHARGE = -1.0;
const ELECTRON_MASS = 1.0;
let TAU = 20; // CZAS RELAKSACJI (TEMPERATURA)

// ZMIANA: NOWE, POPRAWIONE STAŁE DLA GĘSTEJ STRUKTURY I SŁABSZYCH DRGAŃ
const ION_SPRING_CONSTANT = 2.0; // Zwiększona siła do "trzymania" jonu w miejscu (wcześniej 0.05 / 0.5)
const DAMPING_FACTOR = 0.98; // Tłumienie drgań jonów
const THERMAL_NOISE_MULTIPLIER = 0.002; // Mniejszy szum dla jonów (wcześniej 0.01)
const COLLISION_ENERGY_TRANSFER = 0.5; // Współczynnik straty prędkości elektronu przy zderzeniu

// ZMIANA: ZMNIEJSZONA PRĘDKOŚĆ CHAOTYCZNA ELEKTRONÓW
const ELECTRON_INITIAL_SPEED = 3.0; 

// ZMIANA: ZWIĘKSZONE POLE E, ABY DOMINOWAŁO
let E_FIELD_X = 0.5; 
let E_FIELD_Y = 0.0;

let electrons = [];
let ions = [];
let average_drift_velocity = 0;

// ZMIENNE DO STEROWANIA OBSZAREM WIZUALIZACJI
let SIM_AREA_START_X;
let SIM_AREA_START_Y;
let SIM_AREA_WIDTH;
let SIM_AREA_HEIGHT;

// Elementy GUI
let eFieldSlider;
let tempSlider;
let particleCountInput;

// --- KLASA ION (Wibracje Termiczne) ---

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
        // Dodanie małego szumu termicznego
        this.vx_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        this.vy_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        
        // Obliczenie siły przywracającej (Prawo Hooke'a)
        const dx = this.x_current - this.x_init;
        const dy = this.y_current - this.y_init;
        
        // Użycie ZWIĘKSZONEJ SIŁY PRZYWRACAJĄCEJ
        const ax = -ION_SPRING_CONSTANT * dx;
        const ay = -ION_SPRING_CONSTANT * dy;

        // Całkowanie Eulera
        this.vx_thermal += ax * dt;
        this.vy_thermal += ay * dt;
        
        // Tłumienie prędkości
        this.vx_thermal *= DAMPING_FACTOR;
        this.vy_thermal *= DAMPING_FACTOR;

        // Aktualizacja pozycji chwilowej
        this.x_current += this.vx_thermal * dt;
        this.y_current += this.vy_thermal * dt;
    }

    display() {
        const ION_SIZE = CELL_SIZE * 1.5; 
        fill(0, 150, 255); // Niebieski
        noStroke();
        
        const drawX = this.x_current * CELL_SIZE + SIM_AREA_START_X;
        const drawY = this.y_current * CELL_SIZE + SIM_AREA_START_Y;
        
        ellipse(drawX, drawY, ION_SIZE, ION_SIZE);
        
        // Dodanie znaku "+" do jonu
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
    // Użycie ZMNIEJSZONEJ prędkości początkowej
    this.vx = random(-ELECTRON_INITIAL_SPEED, ELECTRON_INITIAL_SPEED); 
    this.vy = random(-ELECTRON_INITIAL_SPEED, ELECTRON_INITIAL_SPEED);
  }

  update() {
    // 1. Obliczanie siły z pola elektrycznego
    const ax = (ELECTRON_CHARGE * E_FIELD_X) / ELECTRON_MASS;
    const ay = (ELECTRON_CHARGE * E_FIELD_Y) / ELECTRON_MASS;

    // 2. Całkowanie Eulera
    this.vx += ax * dt;
    this.vy += ay * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // 3. Sprawdzanie zderzeń
    this.checkCollision(ions);

    // 4. Warunki brzegowe (okresowe - torus)
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
            
            // Przeniesienie energii do jonu
            ion.vx_thermal += v_loss * normal_x * 0.5;
            ion.vy_thermal += v_loss * normal_y * 0.5;
            
            // Odsunięcie elektronu
            this.x += normal_x * 0.1;
            this.y += normal_y * 0.1;
            
            return;
        }
      }
    }
  }

  display() {
    const ELECTRON_SIZE = CELL_SIZE * 0.8;
    fill(255, 255, 0); // Żółty
    noStroke();
    
    const drawX = this.x * CELL_SIZE + SIM_AREA_START_X;
    const drawY = this.y * CELL_SIZE + SIM_AREA_START_Y;
    
    ellipse(drawX, drawY, ELECTRON_SIZE, ELECTRON_SIZE);
    
    // Dodanie znaku "-" do elektronu
    fill(0); // Czarny tekst
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

function defineLayout() {
  const GUI_WIDTH = 250;
  SIM_AREA_START_X = GUI_WIDTH;
  SIM_AREA_START_Y = 0;
  SIM_AREA_WIDTH = width - GUI_WIDTH;
  SIM_AREA_HEIGHT = height;

  L_GRID_WIDTH = floor(SIM_AREA_WIDTH / CELL_SIZE);
  L_GRID_HEIGHT = floor(SIM_AREA_HEIGHT / CELL_SIZE);
}

function initializeElectrons() {
  electrons = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    electrons.push(new Electron());
  }
}

// ZMIANA: Implementacja GĘSTSZEJ SIATKI i użycie klasy Ion
function initializeIons() {
  ions = [];
  const ION_SPACING = 12; // ZMNIEJSZONY ODSTĘP dla gęstszej struktury
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
  
  fill(40, 40, 40); 
  rect(SIM_AREA_START_X, SIM_AREA_START_Y, SIM_AREA_WIDTH, SIM_AREA_HEIGHT);
  
  // Aktualizacja i rysowanie Jonów
  for (let ion of ions) {
      ion.update(); // Aktualizacja drgań
      ion.display(); // Rysowanie
  }

  // Symulacja elektronów
  let total_vx = 0;
  for (let e of electrons) {
    e.update();
    e.display();
    total_vx += e.vx;
  }

  // Obliczenie średniej prędkości dryfu
  average_drift_velocity = total_vx / N_PARTICLES;

  // --- 3. Wizualizacja Wyników w Obszarze Symulacji ---
  
  drawEFieldIndicator();

  fill(255);
  noStroke();
  textSize(14);
  
  text(
    `Średnia prędkość dryfu vx: ${average_drift_velocity.toFixed(3)}`,
    SIM_AREA_START_X + 10,
    SIM_AREA_HEIGHT - 30
  );
  
  text(
    `Liczba elektronów: ${N_PARTICLES}`,
    SIM_AREA_START_X + 10,
    SIM_AREA_HEIGHT - 10
  );

}

function drawEFieldIndicator() {
  const cx = SIM_AREA_START_X + 50;
  const cy = 30;
  const arrow_length = 30;

  stroke(255, 100, 100);
  strokeWeight(2);
  fill(255, 100, 100);

  // Rysowanie wektora pola E
  const endX = cx + E_FIELD_X * arrow_length * 50;
  const endY = cy + E_FIELD_Y * arrow_length * 50;

  line(cx, cy, endX, endY);

  // Rysowanie grotu strzałki
  push();
  translate(endX, endY);
  rotate(atan2(endY - cy, endX - cx));
  triangle(0, 0, -5, 2, -5, -2);
  pop();

  noStroke();
  text(`E = (${E_FIELD_X.toFixed(2)}, ${E_FIELD_Y.toFixed(2)})`, cx, cy - 10);
}


// --- FUNKCJE GUI ---

function createGUI() {
  const style = `
    font-family: Arial, sans-serif;
    padding: 5px;
    margin: 5px;
    color: white;
  `;
  
  const PADDING = 10;
  let y_pos = PADDING;

  // --- 1. Kontrola Pola Elektrycznego ---
  
  createP('**Pole Elektryczne E (Vx)**').position(PADDING, y_pos).style(style);
  y_pos += 40;
  
  eFieldSlider = createSlider(-0.5, 0.5, E_FIELD_X, 0.01)
    .position(PADDING, y_pos)
    .style('width', '200px')
    .input(updateEField);
  y_pos += 40;
  
  createP('**Współczynnik Temperatury (1/τ)**').position(PADDING, y_pos).style(style);
  y_pos += 40;
  
  // --- 2. Kontrola Temperatury (TAU) ---
  
  tempSlider = createSlider(5, 50, TAU, 1) 
    .position(PADDING, y_pos)
    .style('width', '200px')
    .input(updateTemperature);
  y_pos += 40;

  // --- 3. Kontrola Liczby Elektronów ---
  
  createP('**Liczba Elektronów**').position(PADDING, y_pos).style(style);
  y_pos += 40;
  
  particleCountInput = createInput(N_PARTICLES.toString(), 'number')
    .position(PADDING, y_pos)
    .style('width', '100px')
    .style('background', '#333')
    .style('color', 'white')
    .style(style);
  y_pos += 40;
  
  createButton('Zastosuj Nową Liczbę').position(PADDING, y_pos).mousePressed(updateParticleCount).style(style);
}

function drawGUIArea() {
  // Tło dla kolumny GUI
  fill(30, 30, 30);
  rect(0, 0, SIM_AREA_START_X, height);
  
  // Wyświetlanie aktualnych wartości z GUI
  fill(255);
  noStroke();
  textSize(12);
  
  // Wartość E Field
  text(`E_FIELD_X: ${E_FIELD_X.toFixed(2)}`, 10, 85);
  
  // Wartość temperatury (TAU)
  text(`TAU (τ): ${TAU} (Relaksacja)`, 10, 165);
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
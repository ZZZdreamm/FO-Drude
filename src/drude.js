// --- ZMIENNE GLOBALNE I KONFIGURACJA GUI ---

let L_GRID_WIDTH;  
let L_GRID_HEIGHT; 
const CELL_SIZE = 15; 

let N_PARTICLES = 300; 

// Parametry fizyczne
const dt = 0.1; 
const ELECTRON_CHARGE = -1.0;
const ELECTRON_MASS = 1.0;
let TAU = 20; // Ustawienie domyślne, zmieniane przez suwak
let E_FIELD_VALUE = 0.5; // Zmienna do przechowywania wartości slidera E
let current_e_field = 0.0; // Zmienna do śledzenia aktualnego stanu E_FIELD_X

// Parametry jonów
const ION_SPRING_CONSTANT = 2.0; 
const DAMPING_FACTOR = 0.98; 
let THERMAL_NOISE_MULTIPLIER = 0.0005; // Zmieniane przez slider temperatury jonów
const COLLISION_ENERGY_TRANSFER = 0.5; 

// Parametry elektronów
const ELECTRON_INITIAL_SPEED = 3.0; 
let ELECTRON_THERMAL_NOISE = 0.05; // Zmieniane przez slider temperatury elektronów
let E_FIELD_X = 0.0; // Główna zmienna pola E w logice fizycznej
let E_FIELD_Y = 0.0;

let electrons = [];
let ions = [];
let average_drift_velocity = 0;

// Liczniki
let electrons_left_side = 0;
let electrons_right_side = 0;
const BOUNDARY_RATIO = 0.5; 

// UKŁAD
let SIM_AREA_START_X;
let SIM_AREA_START_Y;
let SIM_AREA_WIDTH;
let SIM_AREA_HEIGHT;
const GUI_TOP_HEIGHT = 50; 
const GUI_BOTTOM_HEIGHT = 180; // Zwiększona wysokość na estetyczne GUI

// Elementy GUI
let eFieldSlider;
let tempSlider;
let particleCountInput;
let textEField;
let textTemp;
let eFieldButton; // Dodany przycisk do przełączania E Field


// --- PALETA KOLORÓW ---
const COLOR_BACKGROUND = '#1C1C1E'; // Ciemny grafit
const COLOR_METAL = '#33333A';     // Ciemny popiel
const COLOR_ION = '#00AEEF';       // Neonowy Cyjan (Jony)
const COLOR_ELECTRON = '#FFC300';  // Jasny Pomarańcz/Żółty (Elektrony)
const COLOR_ACCENT = '#FF4500';    // Czerwony Akcent (E Field)
const COLOR_TEXT = '#EAEAEA';      // Jasny Tekst


// --- KLASA ION ---

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
        fill(COLOR_ION); 
        noStroke();
        
        const drawX = this.x_current * CELL_SIZE + SIM_AREA_START_X;
        const drawY = this.y_current * CELL_SIZE + SIM_AREA_START_Y;
        
        ellipse(drawX, drawY, ION_SIZE, ION_SIZE);
        
        fill(COLOR_TEXT); 
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
    fill(COLOR_ELECTRON); 
    noStroke();
    
    const drawX = this.x * CELL_SIZE + SIM_AREA_START_X;
    const drawY = this.y * CELL_SIZE + SIM_AREA_START_Y;
    
    ellipse(drawX, drawY, ELECTRON_SIZE, ELECTRON_SIZE);
    
    fill(COLOR_BACKGROUND); // Ciemny znak minus
    textSize(CELL_SIZE);
    textAlign(CENTER, CENTER);
    text('-', drawX, drawY);
  }
}

// --- FUNKCJE SETUP I RYSOWANIE ---

function setup() {
  createCanvas(windowWidth, windowHeight);
  // ZMIANA: Ustawienie czcionki
  textFont('Arial, sans-serif'); 
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
  // Zmniejszenie marginesów bocznych, aby obszar GUI nie był zbyt szeroki
  const MARGIN_X = 150; 
  const MARGIN_Y = 20;

  SIM_AREA_START_X = MARGIN_X;
  SIM_AREA_START_Y = GUI_TOP_HEIGHT + MARGIN_Y; 
  SIM_AREA_WIDTH = width - 2 * MARGIN_X;
  SIM_AREA_HEIGHT = height - GUI_TOP_HEIGHT - GUI_BOTTOM_HEIGHT; 

  // Zapewnienie minimalnego rozmiaru
  if (SIM_AREA_WIDTH < 100) SIM_AREA_WIDTH = 100;
  if (SIM_AREA_HEIGHT < 100) SIM_AREA_HEIGHT = 100;

  L_GRID_WIDTH = floor(SIM_AREA_WIDTH / CELL_SIZE);
  L_GRID_HEIGHT = floor(SIM_AREA_HEIGHT / CELL_SIZE);
  
  // Przeniesienie elementów GUI
  if (eFieldSlider) {
    eFieldSlider.position(width / 2 - 400, height - GUI_BOTTOM_HEIGHT + 70);
    tempSlider.position(width / 2 - 150, height - GUI_BOTTOM_HEIGHT + 70);
    particleCountInput.position(width / 2 + 100, height - GUI_BOTTOM_HEIGHT + 70);
    select('#applyButton').position(width / 2 + 230, height - GUI_BOTTOM_HEIGHT + 70);
    eFieldButton.position(width / 2 - 550, height - GUI_BOTTOM_HEIGHT + 70);
    
    // Przeniesienie tekstu
    select('#eFieldText').position(width / 2 - 400, height - GUI_BOTTOM_HEIGHT + 20);
    select('#tempText').position(width / 2 - 150, height - GUI_BOTTOM_HEIGHT + 20);
    select('#particleText').position(width / 2 + 100, height - GUI_BOTTOM_HEIGHT + 20);
    select('#eFieldButtonText').position(width / 2 - 550, height - GUI_BOTTOM_HEIGHT + 20);
  }
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
  background(COLOR_BACKGROUND); 
    
  // --- 1. Rysowanie Obszaru GUI (Kontroli) ---
  drawGUIArea();

  // --- 2. Rysowanie Obszaru Symulacji (Metal) ---
  
  // Wytłaczana obwódka
  fill(COLOR_METAL); 
  rect(SIM_AREA_START_X, SIM_AREA_START_Y, SIM_AREA_WIDTH, SIM_AREA_HEIGHT);
  
  // Aktualizacja i rysowanie Jonów
  for (let ion of ions) {
      ion.update(); 
      ion.display(); 
  }

    electrons_left_side = 0;
    electrons_right_side = 0;

  // Symulacja elektronów
  let total_vx = 0;
    const boundary_x = L_GRID_WIDTH * BOUNDARY_RATIO; 

  for (let e of electrons) {
    e.update();
    e.display();
    total_vx += e.vx;
    
    if (e.x < boundary_x) {
        electrons_left_side++;
    } else {
        electrons_right_side++;
    }
  }

  average_drift_velocity = total_vx / N_PARTICLES;

  // --- 3. Wizualizacja Wyników i Statystyk ---
  drawSideInfo();
  drawEFieldIndicator();
}

function drawSideInfo() {
    fill(COLOR_TEXT);
    noStroke();
    
    // Duży napis "Metal"
    textAlign(CENTER, CENTER);
    textSize(36);
    text('Model Przewodnictwa Drudego', width / 2, SIM_AREA_START_Y - 30); 
    
    // Lewa strona (liczniki)
    textAlign(RIGHT, TOP);
    textSize(20);
    text('N_LEFT:', SIM_AREA_START_X - 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_left_side}`, SIM_AREA_START_X - 20, SIM_AREA_START_Y + 130);
    
    // Prawa strona (liczniki)
    textAlign(LEFT, TOP);
    textSize(20);
    text('N_RIGHT:', SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_right_side}`, SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 130);
    
    // Wizualizacja prądu/dryfu na dole
    textAlign(LEFT, TOP);
    textSize(16);
    fill(COLOR_ELECTRON); 
    text(
        `Drift Velocity vx: ${average_drift_velocity.toFixed(3)}`,
        SIM_AREA_START_X,
        SIM_AREA_START_Y + SIM_AREA_HEIGHT + 30
    );
    
    // Wskaźnik temperatury
    fill(COLOR_ION); 
    text(
        `Tau (Relaxation Time): ${TAU} | Ion Noise: ${THERMAL_NOISE_MULTIPLIER}`,
        SIM_AREA_START_X,
        SIM_AREA_START_Y + SIM_AREA_HEIGHT + 60
    );
}

function drawEFieldIndicator() {
  const cx = SIM_AREA_START_X + SIM_AREA_WIDTH - 100;
  const cy = SIM_AREA_START_Y + 30; // W górnym prawym rogu metalu

  stroke(COLOR_ACCENT);
  strokeWeight(3);
  fill(COLOR_ACCENT);
 
  // Rysowanie wektora Pola E
  const arrow_magnitude = E_FIELD_X * 50; 
  const endX = cx + arrow_magnitude;
  const endY = cy + E_FIELD_Y * 50;

  line(cx, cy, endX, endY);

  push();
  translate(endX, endY);
  rotate(atan2(endY - cy, endX - cx));
  triangle(0, 0, -8, 4, -8, -4); // Większa strzałka
  pop();

  noStroke();
  fill(COLOR_TEXT);
  textSize(14);
  textAlign(RIGHT, CENTER);
  text(`E = ${E_FIELD_X.toFixed(2)}`, SIM_AREA_START_X + SIM_AREA_WIDTH - 10, SIM_AREA_START_Y + 30);
}


// --- FUNKCJE GUI ---

function createGUI() {
  // Ustawienie stałych dla CSS
  const INPUT_STYLE = `
    background: ${COLOR_METAL}; 
    color: ${COLOR_TEXT};
    border: 1px solid ${COLOR_ION};
    padding: 8px;
    font-size: 14px;
    width: 100px;
  `;
  
  const SLIDER_STYLE = `
    width: 200px;
    -webkit-appearance: none;
    background: ${COLOR_METAL};
    height: 8px;
    border-radius: 4px;
  `;
  
  const BUTTON_STYLE = `
    background: ${COLOR_ION};
    color: ${COLOR_BACKGROUND};
    border: none;
    padding: 10px 15px;
    font-size: 14px;
    cursor: pointer;
    width: 120px;
    font-weight: bold;
  `;
  
  // Zmienne do centralnego pozycjonowania
  const BASE_Y = height - GUI_BOTTOM_HEIGHT + 20;
  const COL_GAP = 250;
  const CENTER_X = width / 2;
  
  let x_pos = CENTER_X - 550; // Początkowa pozycja na lewo
  
  // Funkcja pomocnicza do tworzenia P
  const createPStyled = (content, id, x, y) => {
    return createP(`<strong>${content}</strong>`)
      .position(x, y)
      .style(`color: ${COLOR_TEXT}; font-size: 16px;`)
      .id(id);
  };
  
  // --- 1. Kontrola Pola E (Przycisk ON/OFF) ---
  createPStyled('POLE E:', 'eFieldButtonText', x_pos, BASE_Y);
  eFieldButton = createButton('Toggle E Field')
    .position(x_pos, BASE_Y + 50)
    .mousePressed(toggleEField)
    .style(BUTTON_STYLE)
    .style(`background: ${E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION}`);
  
  x_pos += COL_GAP - 100; // Dostosowanie odstępu
  
  // --- 2. Kontrola Wartości Pola E (Slider) ---
  textEField = createPStyled('Wartość E (Vx):', 'eFieldText', x_pos, BASE_Y);
  eFieldSlider = createSlider(-0.5, 0.5, E_FIELD_X, 0.01)
    .position(x_pos, BASE_Y + 50)
    .style(SLIDER_STYLE)
    .input(updateEField);
  
  x_pos += COL_GAP;
  
  // --- 3. Kontrola Temperatury (TAU) ---
  createPStyled('Czas Relaksacji (τ):', 'tempText', x_pos, BASE_Y);
  tempSlider = createSlider(5, 50, TAU, 1) 
    .position(x_pos, BASE_Y + 50)
    .style(SLIDER_STYLE)
    .input(updateTemperature);
  
  x_pos += COL_GAP;

  // --- 4. Kontrola Liczby Elektronów ---
  createPStyled('Liczba Elektronów:', 'particleText', x_pos, BASE_Y);
  particleCountInput = createInput(N_PARTICLES.toString(), 'number')
    .position(x_pos, BASE_Y + 50)
    .style(INPUT_STYLE);

  x_pos += 150;

  // --- 5. Przycisk Zastosuj ---
  createButton('Zastosuj').id('applyButton')
    .position(x_pos, BASE_Y + 50)
    .mousePressed(updateParticleCount)
    .style(BUTTON_STYLE)
    .style('background', COLOR_ION);
    
  // Inicjalizacja tekstu na dole (Wartości dynamiczne)
  createPStyled(`Noise E: ${ELECTRON_THERMAL_NOISE.toFixed(3)} | Noise Ion: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`, 
                 'noiseText', CENTER_X - 150, BASE_Y + 100)
    .style('font-size', '14px');
}

function drawGUIArea() {
  // Tło dla GUI
  fill(COLOR_BACKGROUND);
  rect(0, 0, width, GUI_TOP_HEIGHT);
  rect(0, height - GUI_BOTTOM_HEIGHT, width, GUI_BOTTOM_HEIGHT);
  
  // Podświetlanie przycisku E Field
  eFieldButton.style('background', E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION);
  eFieldButton.html(E_FIELD_X !== 0 ? 'E Field (ON)' : 'E Field (OFF)');

  // Aktualizacja tekstu GUI
  select('#eFieldText').html(`Wartość E (Vx): ${eFieldSlider.value().toFixed(2)}`);
  select('#tempText').html(`Czas Relaksacji (τ): ${TAU}`);
  
  // Zmiana stałych szumu w zależności od TAU (symulacja temperatury)
  // Wprowadzamy prostą relację odwrotną między TAU (czasem relaksacji) a szumem termicznym
  const new_tau = tempSlider.value();
  const max_tau = 50;
  const min_tau = 5;
  const noise_range_E = 0.1;
  const noise_range_I = 0.003;
  
  // Normalizacja TAU na zakres [0, 1] (0 to max temp, 1 to min temp)
  const normalized_temp = map(new_tau, min_tau, max_tau, 1, 0); 
  
  // Im niższe TAU, tym wyższa temperatura i wyższy szum
  ELECTRON_THERMAL_NOISE = 0.01 + normalized_temp * noise_range_E;
  THERMAL_NOISE_MULTIPLIER = 0.0005 + normalized_temp * noise_range_I;
  TAU = new_tau;

  select('#noiseText').html(`Noise E: ${ELECTRON_THERMAL_NOISE.toFixed(3)} | Noise Ion: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`);
}

function toggleEField() {
    // Włączenie/wyłączenie pola z użyciem wartości ze slidera
    if (E_FIELD_X === 0) {
        // Aktywacja pola z wartością slidera (lub domyślną)
        current_e_field = eFieldSlider.value();
        if (abs(current_e_field) < 0.01) current_e_field = 0.5; 
        E_FIELD_X = current_e_field;
    } else {
        // Wyłączenie pola
        E_FIELD_X = 0;
    }
}

function updateEField() {
    // Jeśli pole jest aktywne, zmień jego wartość natychmiast
    if (E_FIELD_X !== 0) {
        E_FIELD_X = eFieldSlider.value();
    }
}

function updateTemperature() {
    // TAU jest bezpośrednio odczytywane w draw() i jest powiązane z szumem
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
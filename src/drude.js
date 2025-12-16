// --- ZMIENNE GLOBALNE I KONFIGURACJA GUI ---

let L_GRID_WIDTH;  
let L_GRID_HEIGHT; 
const CELL_SIZE = 15; 

let N_PARTICLES = 200; 

// Parametry fizyczne
const dt = 0.1; 
const ELECTRON_CHARGE = -1.0;
const ELECTRON_MASS = 1.0;
let TAU = 20; 
let E_FIELD_VALUE = 0.5; 
let current_e_field = 0.0; 

// Parametry jonów
const ION_SPRING_CONSTANT = 5.0; // Wzmocniona sprężystość
const DAMPING_FACTOR = 0.98; 
let THERMAL_NOISE_MULTIPLIER = 0.0005; 
const COLLISION_ENERGY_TRANSFER = 0.5; 
const ION_MAX_THERMAL_SPEED = 0.5; // NOWA STAŁA: Maksymalna prędkość termiczna jonu

// Parametry elektronów
const ELECTRON_INITIAL_SPEED = 3.0; 
let ELECTRON_THERMAL_NOISE = 0.15; 
let E_FIELD_X = 0.0; 
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
const GUI_BOTTOM_HEIGHT = 180; 

// Elementy GUI
let eFieldSlider;
let tempSlider;
let particleCountInput;
let textEField;
let textTemp;
let eFieldButton; 


// --- PALETA KOLORÓW ---
const COLOR_BACKGROUND = '#1C1C1E'; 
const COLOR_METAL = '#33333A';       
const COLOR_ION = '#00AEEF';         
const COLOR_ELECTRON = '#FFC300';   
const COLOR_ACCENT = '#FF4500';      
const COLOR_TEXT = '#EAEAEA';       


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
        // Dodanie szumu termicznego
        this.vx_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        this.vy_thermal += random(-THERMAL_NOISE_MULTIPLIER, THERMAL_NOISE_MULTIPLIER);
        
        // Siła sprężysta (siła powrotu do punktu równowagi)
        const dx = this.x_current - this.x_init;
        const dy = this.y_current - this.y_init;
        const ax = -ION_SPRING_CONSTANT * dx;
        const ay = -ION_SPRING_CONSTANT * dy;

        // Zmiana prędkości
        this.vx_thermal += ax * dt;
        this.vy_thermal += ay * dt;
        this.vx_thermal *= DAMPING_FACTOR;
        this.vy_thermal *= DAMPING_FACTOR;

        // Ograniczenie maksymalnej prędkości termicznej (limit drgań)
        const currentSpeedSq = this.vx_thermal * this.vx_thermal + this.vy_thermal * this.vy_thermal;
        const maxSpeedSq = ION_MAX_THERMAL_SPEED * ION_MAX_THERMAL_SPEED;
        
        if (currentSpeedSq > maxSpeedSq) {
            const scale = ION_MAX_THERMAL_SPEED / sqrt(currentSpeedSq);
            this.vx_thermal *= scale;
            this.vy_thermal *= scale;
        }

        // Aktualizacja pozycji
        this.x_current += this.vx_thermal * dt;
        this.y_current += this.vy_thermal * dt;
        
        // Ograniczenie pozycji jonu do granic obszaru symulacji
        const MARGIN = 1.0; 
        this.x_current = constrain(this.x_current, MARGIN, L_GRID_WIDTH - MARGIN);
        this.y_current = constrain(this.y_current, MARGIN, L_GRID_HEIGHT - MARGIN);
    }

    display() {
        const ION_SIZE = CELL_SIZE * 2.25; 
        fill(COLOR_ION); 
        noStroke();
        
        const drawX = this.x_current * CELL_SIZE + SIM_AREA_START_X;
        const drawY = this.y_current * CELL_SIZE + SIM_AREA_START_Y;
        
        ellipse(drawX, drawY, ION_SIZE, ION_SIZE);
        
        fill(COLOR_BACKGROUND); 
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
            
            const v_final_normal = -v_normal * COLLISION_ENERGY_TRANSFER * 0.2; 
            
            const v_initial_x = this.vx;
            const v_initial_y = this.vy;

            const v_tangential_x = v_initial_x - v_normal * normal_x;
            const v_tangential_y = v_initial_y - v_normal * normal_y;

            this.vx = v_tangential_x + v_final_normal * normal_x;
            this.vy = v_tangential_y + v_final_normal * normal_y;
            
            const v_change_electron = v_final_normal - v_normal; 
            
            const ION_IMPULSE_FACTOR = 0.5; 
            const v_transfer = v_change_electron * ION_IMPULSE_FACTOR;
            
            ion.vx_thermal -= v_transfer * normal_x;
            ion.vy_thermal -= v_transfer * normal_y;
            
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
    
    fill(COLOR_BACKGROUND); 
    textSize(CELL_SIZE);
    textAlign(CENTER, CENTER);
    text('-', drawX, drawY);
  }
}


function setupPageStyles() {
  select('body').style('margin', '0');
  select('body').style('padding', '0');
  select('body').style('overflow', 'hidden'); 
}

function setup() {
  setupPageStyles(); 
  createCanvas(windowWidth, windowHeight);
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
  // Używamy zwiększonego MARGIN_X=180
  const MARGIN_X = 180; 
  const MARGIN_Y = 20;

  SIM_AREA_START_X = MARGIN_X;
  SIM_AREA_START_Y = GUI_TOP_HEIGHT + MARGIN_Y; 
  SIM_AREA_WIDTH = width - 2 * MARGIN_X;
  SIM_AREA_HEIGHT = height - GUI_TOP_HEIGHT - GUI_BOTTOM_HEIGHT; 

  if (SIM_AREA_WIDTH < 100) SIM_AREA_WIDTH = 100;
  if (SIM_AREA_HEIGHT < 100) SIM_AREA_HEIGHT = 100;

  L_GRID_WIDTH = floor(SIM_AREA_WIDTH / CELL_SIZE);
  L_GRID_HEIGHT = floor(SIM_AREA_HEIGHT / CELL_SIZE);
  
  // Repozycjonowanie elementów GUI po zmianie rozmiaru
  const BASE_Y = height - GUI_BOTTOM_HEIGHT + 20;
  const CENTER_X = width / 2;
  
  if (eFieldSlider) {
    // Kolumna 1 (Przycisk)
    select('#eFieldButtonText').position(CENTER_X - 550, BASE_Y + 10);
    eFieldButton.position(CENTER_X - 550, BASE_Y + 45);

    // Kolumna 2 (Slider E)
    select('#eFieldText').position(CENTER_X - 400, BASE_Y + 10);
    eFieldSlider.position(CENTER_X - 400, BASE_Y + 45); 
    
    // Kolumna 3 (Slider TAU)
    select('#tempText').position(CENTER_X - 150, BASE_Y + 10);
    tempSlider.position(CENTER_X - 150, BASE_Y + 45); 
    
    // Kolumna 4 (Input N)
    select('#particleText').position(CENTER_X + 100, BASE_Y + 10);
    particleCountInput.position(CENTER_X + 100, BASE_Y + 45);
    
    // Kolumna 5 (Przycisk Zastosuj)
    select('#applyButton').position(CENTER_X + 230, BASE_Y + 45);
    
    // Tekst szumu (niżej, wyśrodkowany)
//     select('#noiseText').position(CENTER_X - 150, BASE_Y + 100);
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
  const ION_SPACING = 8; 
  const START_MARGIN = ION_SPACING / 2; 


  const VERTICAL_OFFSET = ION_SPACING / 2; 
  
  for (let i = START_MARGIN; i < L_GRID_WIDTH - START_MARGIN; i += ION_SPACING) {
      
      const col_index = Math.floor((i - START_MARGIN) / ION_SPACING);
      const current_offset = (col_index % 2 === 0) ? 0 : VERTICAL_OFFSET;
      
      for (let j = START_MARGIN + current_offset; 
             j < L_GRID_HEIGHT - START_MARGIN; 
             j += ION_SPACING) 
      {
            ions.push(new Ion(i, j));
      }
  }
}

function draw() {
  background(COLOR_BACKGROUND); 
    
  drawGUIArea();

  
  fill(COLOR_METAL); 
  rect(SIM_AREA_START_X, SIM_AREA_START_Y, SIM_AREA_WIDTH, SIM_AREA_HEIGHT);
  
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
    
    // Duży napis
    textAlign(CENTER, CENTER);
    textSize(36);
    text('Model Przewodnictwa Drudego', width / 2, SIM_AREA_START_Y - 30); 
    
    // Lewa strona (liczniki)
    textAlign(RIGHT, TOP);
    textSize(20);
    text('Liczba (Lewa):', SIM_AREA_START_X - 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_left_side}`, SIM_AREA_START_X - 20, SIM_AREA_START_Y + 135); 
    
    // Prawa strona (liczniki)
    textAlign(LEFT, TOP);
    textSize(20);
    text('Liczba (Prawa):', SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 100); 
    textSize(36);
    text(`${electrons_right_side}`, SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 135); 
    
    const BASE_INFO_Y = SIM_AREA_START_Y + SIM_AREA_HEIGHT + 15; 
    
    // ZMIANA: Przesunięcie na LEWO o 100 pikseli
    const INFO_X = SIM_AREA_START_X - 150; 

    textAlign(LEFT, TOP);
    textSize(16);
    
    // Prędkość Dryfu (na dole, w lewej kolumnie)
    fill(COLOR_ELECTRON); 
    text(
        `Prędkość Dryfu vx: ${average_drift_velocity.toFixed(3)}`,
        INFO_X,
        BASE_INFO_Y
    );
    
    // Wskaźnik temperatury (poniżej prędkości dryfu)
    fill(COLOR_ION); 
    text(
        `Czas Relaksacji (Tau): ${TAU}
        Szum Jonów: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`,
        INFO_X,
        BASE_INFO_Y + 25 
    );
}

function drawEFieldIndicator() {
  const cx = SIM_AREA_START_X + SIM_AREA_WIDTH - 100;
  const cy = SIM_AREA_START_Y + 30; 

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
  triangle(0, 0, -8, 4, -8, -4); 
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
    /* Usunięto width: 120px; */
    font-weight: bold;
  `;
  
  // Zmienne do centralnego pozycjonowania
  const BASE_Y = height - GUI_BOTTOM_HEIGHT + 20;
  const CENTER_X = width / 2;
  
  let x_pos = CENTER_X - 550; 
  
  // Funkcja pomocnicza do tworzenia P
  const createPStyled = (content, id, x, y) => {
    return createP(`<strong>${content}</strong>`)
      .position(x, y)
      .style(`color: ${COLOR_TEXT}; font-size: 16px;`)
      .id(id);
  };
  
  // --- 1. Kontrola Pola E (Przycisk ON/OFF) ---
  createPStyled('Pole Elektryczne:', 'eFieldButtonText', x_pos, BASE_Y + 10);
  eFieldButton = createButton('Przełącz E')
    .position(x_pos, BASE_Y + 45)
    .mousePressed(toggleEField)
    .style(BUTTON_STYLE)
    .style(`background: ${E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION}`);
  
  x_pos += 150; 
  
  // --- 2. Kontrola Wartości Pola E (Slider) ---
  createPStyled('Wartość Pola E:', 'eFieldText', x_pos, BASE_Y + 10);
  eFieldSlider = createSlider(-0.5, 0.5, 0.0, 0.01) // Używamy 0.0 jako początkowej wartości
    .position(x_pos, BASE_Y + 45)
    .style(SLIDER_STYLE)
    .input(updateEField);
  
  x_pos += 250;
  
  // --- 3. Kontrola Temperatury (TAU) ---
  createPStyled('Czas Relaksacji (τ):', 'tempText', x_pos, BASE_Y + 10);
  tempSlider = createSlider(5, 50, TAU, 1) 
    .position(x_pos, BASE_Y + 45)
    .style(SLIDER_STYLE)
    .input(updateTemperature);
  
  x_pos += 250;

  // --- 4. Kontrola Liczby Elektronów ---
  createPStyled('Liczba Elektronów:', 'particleText', x_pos, BASE_Y + 10);
  particleCountInput = createInput(N_PARTICLES.toString(), 'number')
    .position(x_pos, BASE_Y + 45)
    .style(INPUT_STYLE);

  x_pos += 150;

  // --- 5. Przycisk Zastosuj ---
  createButton('Zastosuj').id('applyButton')
    .position(x_pos, BASE_Y + 45)
    .mousePressed(updateParticleCount)
    .style(BUTTON_STYLE)
    .style('background', COLOR_ION);
    
  // Inicjalizacja tekstu na dole (Wartości dynamiczne)
//   createPStyled(`Szum E: ${ELECTRON_THERMAL_NOISE.toFixed(3)} | Szum Jonów: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`, 
//                  'noiseText', CENTER_X - 150, BASE_Y + 100)
//     .style('font-size', '14px');
    
    // Konieczne jest wywołanie defineLayout() ponownie po utworzeniu elementów,
    // aby pozycje były poprawne od razu
    defineLayout(); 
}

function drawGUIArea() {
  // Tło dla GUI
  fill(COLOR_BACKGROUND);
  rect(0, 0, width, GUI_TOP_HEIGHT);
  rect(0, height - GUI_BOTTOM_HEIGHT, width, GUI_BOTTOM_HEIGHT);
  
  // Podświetlanie przycisku E Field
  eFieldButton.style('background', E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION);
  eFieldButton.html(E_FIELD_X !== 0 ? 'POLE E (WŁ.)' : 'POLE E (WYŁ.)');

  // Aktualizacja tekstu GUI
  select('#eFieldText').html(`Wartość Pola E: ${eFieldSlider.value().toFixed(2)}`);
  select('#tempText').html(`Czas Relaksacji (τ): ${TAU}`);
  
  const new_tau = tempSlider.value();
  const max_tau = 50;
  const min_tau = 5;
  const noise_range_E = 0.1;
  const noise_range_I = 0.003;
  
  const normalized_temp = map(new_tau, min_tau, max_tau, 1, 0); 
  
  ELECTRON_THERMAL_NOISE = 0.01 + normalized_temp * noise_range_E;
  THERMAL_NOISE_MULTIPLIER = 0.0005 + normalized_temp * noise_range_I;
  TAU = new_tau;

//   select('#noiseText').html(`Szum E: ${ELECTRON_THERMAL_NOISE.toFixed(3)} | Szum Jonów: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`);
}

function toggleEField() {
    if (E_FIELD_X === 0) {
        current_e_field = eFieldSlider.value();
        E_FIELD_X = current_e_field;
    } else {
        E_FIELD_X = 0;
    }
}

function updateEField() {
    if (E_FIELD_X !== 0) {
        E_FIELD_X = eFieldSlider.value();
    }
}

function updateTemperature() {
    // TAU jest aktualizowane w drawGUIArea
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
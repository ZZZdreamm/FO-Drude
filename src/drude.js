let L_GRID_WIDTH;
let L_GRID_HEIGHT;
const CELL_SIZE = 15;

let N_PARTICLES = 200;

const dt = 0.1;
const ELECTRON_CHARGE = -1.0;
const ELECTRON_MASS = 1.0;
let TAU = 20;
let E_FIELD_VALUE = 0.5;
let current_e_field = 0.0;

const ION_SPRING_CONSTANT = 5.0;
const DAMPING_FACTOR = 0.98;
let THERMAL_NOISE_MULTIPLIER = 0.0005;
const COLLISION_ENERGY_TRANSFER = 0.5;
const ION_MAX_THERMAL_SPEED = 0.5;

const ELECTRON_INITIAL_SPEED = 3.0;
let ELECTRON_THERMAL_NOISE = 0.15;
let E_FIELD_X = 0.0;
let E_FIELD_Y = 0.0;

let electrons = [];
let ions = [];
let average_drift_velocity = 0;

let electrons_left_side = 0;
let electrons_right_side = 0;
const BOUNDARY_RATIO = 0.5;

let SIM_AREA_START_X;
let SIM_AREA_START_Y;
let SIM_AREA_WIDTH;
let SIM_AREA_HEIGHT;
const GUI_TOP_HEIGHT = 50;
const GUI_BOTTOM_HEIGHT = 180;

let eFieldSlider;
let tempSlider;
let particleCountInput;
let textEField;
let textTemp;
let eFieldButton;

const COLOR_BACKGROUND = '#1C1C1E';
const COLOR_METAL = '#33333A';
const COLOR_ION = '#00AEEF';
const COLOR_ELECTRON = '#FFC300';
const COLOR_ACCENT = '#FF4500';
const COLOR_TEXT = '#EAEAEA';


const MAX_TRAJECTORY_POINTS = 500;
let trajectory = [];
let trackedElectronIndex = 0;


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

        const currentSpeedSq = this.vx_thermal * this.vx_thermal + this.vy_thermal * this.vy_thermal;
        const maxSpeedSq = ION_MAX_THERMAL_SPEED * ION_MAX_THERMAL_SPEED;

        if (currentSpeedSq > maxSpeedSq) {
            const scale = ION_MAX_THERMAL_SPEED / sqrt(currentSpeedSq);
            this.vx_thermal *= scale;
            this.vy_thermal *= scale;
        }

        this.x_current += this.vx_thermal * dt;
        this.y_current += this.vy_thermal * dt;

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

    update(index) {
        const Fx_E = ELECTRON_CHARGE * E_FIELD_X;
        const Fy_E = ELECTRON_CHARGE * E_FIELD_Y;

        const Fx_relax = -(ELECTRON_MASS / TAU) * this.vx;
        const Fy_relax = -(ELECTRON_MASS / TAU) * this.vy;

        const ax = (Fx_E + Fx_relax) / ELECTRON_MASS;
        const ay = (Fy_E + Fy_relax) / ELECTRON_MASS;

        this.vx += ax * dt;
        this.vy += ay * dt;

        this.vx += random(-ELECTRON_THERMAL_NOISE, ELECTRON_THERMAL_NOISE);
        this.vy += random(-ELECTRON_THERMAL_NOISE, ELECTRON_THERMAL_NOISE);

        let newX = this.x + this.vx * dt;
        let newY = this.y + this.vy * dt;

        this.x = newX;
        this.y = newY;

        this.checkCollision(ions);

        if (index === trackedElectronIndex) {
            let jumped = false;
            
            if (newX < 0 || newX >= L_GRID_WIDTH || newY < 0 || newY >= L_GRID_HEIGHT) {
                jumped = true;
            }
            
            if (jumped) {
                trajectory = [];
            }
        }

        this.x = (this.x + L_GRID_WIDTH) % L_GRID_WIDTH;
        this.y = (this.y + L_GRID_HEIGHT) % L_GRID_HEIGHT;
        
        if (index === trackedElectronIndex) {
            if (trajectory.length === 0) {
                 trajectory.push({ 
                     x: this.x * CELL_SIZE + SIM_AREA_START_X, 
                     y: this.y * CELL_SIZE + SIM_AREA_START_Y 
                 });
            } else {
                trajectory.push({ 
                    x: this.x * CELL_SIZE + SIM_AREA_START_X, 
                    y: this.y * CELL_SIZE + SIM_AREA_START_Y 
                });
                if (trajectory.length > MAX_TRAJECTORY_POINTS) {
                    trajectory.shift();
                }
            }
        }
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

    display(index) {
        const ELECTRON_SIZE = CELL_SIZE * 0.8;
        fill(index === trackedElectronIndex ? COLOR_ACCENT : COLOR_ELECTRON);
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

const GUI_ELEMENT_WIDTH = 200;
const GUI_BUTTON_WIDTH = 120;
const GUI_INPUT_WIDTH = 200;
const GUI_SPACING = 40;
const TOTAL_GUI_WIDTH =
    GUI_BUTTON_WIDTH + GUI_SPACING +
    GUI_ELEMENT_WIDTH + GUI_SPACING +
    GUI_ELEMENT_WIDTH + GUI_SPACING +
    GUI_INPUT_WIDTH + GUI_SPACING +
    GUI_BUTTON_WIDTH;

const START_X_OFFSET = TOTAL_GUI_WIDTH / 2;

function defineLayout() {
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

    const BASE_Y = height - GUI_BOTTOM_HEIGHT + 20;
    const CENTER_X = width / 2;

    let current_x = CENTER_X - START_X_OFFSET;

    if (eFieldSlider) {
        select('#eFieldButtonText').position(current_x, BASE_Y + 10);
        eFieldButton.position(current_x, BASE_Y + 45);
        current_x += GUI_BUTTON_WIDTH + GUI_SPACING;

        select('#eFieldText').position(current_x, BASE_Y + 10);
        eFieldSlider.position(current_x, BASE_Y + 45);
        current_x += GUI_ELEMENT_WIDTH + GUI_SPACING;

        select('#tempText').position(current_x, BASE_Y + 10);
        tempSlider.position(current_x, BASE_Y + 45);
        current_x += GUI_ELEMENT_WIDTH + GUI_SPACING;

        select('#particleText').position(current_x, BASE_Y + 10);
        particleCountInput.position(current_x, BASE_Y + 45);
        current_x += GUI_INPUT_WIDTH + GUI_SPACING;

        select('#applyButton').position(current_x, BASE_Y + 45);
    }
}

function initializeElectrons() {
    electrons = [];
    trajectory = [];
    for (let i = 0; i < N_PARTICLES; i++) {
        electrons.push(new Electron());
    }
    if (trackedElectronIndex >= N_PARTICLES) {
        trackedElectronIndex = 0;
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
            j += ION_SPACING) {
            ions.push(new Ion(i, j));
        }
    }
}

function drawTrajectory() {
    if (trajectory.length < 2) return;

    noFill();
    
    beginShape();
    for (let i = 0; i < trajectory.length; i++) {
        const point = trajectory[i];
        let alpha = map(i, 0, trajectory.length - 1, 50, 255); 
        stroke(red(COLOR_ACCENT), green(COLOR_ACCENT), blue(COLOR_ACCENT), alpha);
        strokeWeight(3);
        if (i > 0) {
            line(trajectory[i-1].x, trajectory[i-1].y, point.x, point.y);
        }
    }
    endShape();
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
    
    drawTrajectory();

    electrons_left_side = 0;
    electrons_right_side = 0;

    let total_vx = 0;
    const boundary_x = L_GRID_WIDTH * BOUNDARY_RATIO;

    for (let i = 0; i < electrons.length; i++) {
        let e = electrons[i];
        e.update(i);
        e.display(i);
        total_vx += e.vx;

        if (e.x < boundary_x) {
            electrons_left_side++;
        } else {
            electrons_right_side++;
        }
    }

    average_drift_velocity = total_vx / N_PARTICLES;

    drawSideInfo();
    drawEFieldIndicator();
}

function drawSideInfo() {
    fill(COLOR_TEXT);
    noStroke();

    textAlign(CENTER, CENTER);
    textSize(36);
    text('Model Przewodnictwa Drudego', width / 2, SIM_AREA_START_Y - 30);

    textAlign(RIGHT, TOP);
    textSize(20);
    text('Liczba (Lewa):', SIM_AREA_START_X - 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_left_side}`, SIM_AREA_START_X - 20, SIM_AREA_START_Y + 135);

    textAlign(LEFT, TOP);
    textSize(20);
    text('Liczba (Prawa):', SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 100);
    textSize(36);
    text(`${electrons_right_side}`, SIM_AREA_START_X + SIM_AREA_WIDTH + 20, SIM_AREA_START_Y + 135);

    const BASE_INFO_Y = SIM_AREA_START_Y + SIM_AREA_HEIGHT + 15;
    const INFO_X = SIM_AREA_START_X - 50;

    textAlign(CENTER, TOP);
    textSize(16);

    fill(COLOR_ELECTRON);
    text(
        `Prędkość Dryfu Vx: ${average_drift_velocity.toFixed(3)}`,
        INFO_X,
        BASE_INFO_Y
    );

    fill(COLOR_ION);
    text(
        `Czas Relaksacji (Tau): ${TAU}`,
        INFO_X,
        BASE_INFO_Y + 25
    );

    text(
        `Szum Jonów: ${THERMAL_NOISE_MULTIPLIER.toFixed(4)}`,
        INFO_X,
        BASE_INFO_Y + 45
    );
}

function drawEFieldIndicator() {
    const cx = SIM_AREA_START_X + SIM_AREA_WIDTH - 100;
    const cy = SIM_AREA_START_Y + 30;

    stroke(COLOR_ACCENT);
    strokeWeight(3);
    fill(COLOR_ACCENT);

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

function createGUI() {
    const INPUT_STYLE = `
    background: ${COLOR_METAL};
    color: ${COLOR_TEXT};
    border: 1px solid ${COLOR_ION};
    padding: 8px;
    font-size: 14px;
    width: ${GUI_INPUT_WIDTH - 18}px;
    `;

    const SLIDER_STYLE = `
    width: ${GUI_ELEMENT_WIDTH}px;
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
    width: ${GUI_BUTTON_WIDTH}px;
    font-weight: bold;
    `;

    const BASE_Y = height - GUI_BOTTOM_HEIGHT + 20;
    const CENTER_X = width / 2;

    let current_x = CENTER_X - START_X_OFFSET;

    const createPStyled = (content, id, x, y, width) => {
        return createP(`<strong>${content}</strong>`)
            .position(x, y)
            .style(`color: ${COLOR_TEXT}; font-size: 16px; width: ${width}px; text-align: center;`)
            .id(id);
    };

    createPStyled('Pole E (ON/OFF):', 'eFieldButtonText', current_x, BASE_Y + 10, GUI_BUTTON_WIDTH);
    eFieldButton = createButton('Przełącz E')
        .position(current_x, BASE_Y + 45)
        .mousePressed(toggleEField)
        .style(BUTTON_STYLE)
        .style(`background: ${E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION}`);

    current_x += GUI_BUTTON_WIDTH + GUI_SPACING;

    createPStyled('Wartość Pola E (Vx):', 'eFieldText', current_x, BASE_Y + 10, GUI_ELEMENT_WIDTH);
    eFieldSlider = createSlider(-0.5, 0.5, 0.0, 0.01)
        .position(current_x, BASE_Y + 45)
        .style(SLIDER_STYLE)
        .input(updateEField);

    current_x += GUI_ELEMENT_WIDTH + GUI_SPACING;

    createPStyled('Czas Relaksacji (τ):', 'tempText', current_x, BASE_Y + 10, GUI_ELEMENT_WIDTH);
    tempSlider = createSlider(5, 50, TAU, 1)
        .position(current_x, BASE_Y + 45)
        .style(SLIDER_STYLE)
        .input(updateTemperature);

    current_x += GUI_ELEMENT_WIDTH + GUI_SPACING;

    createPStyled('Liczba Elektronów:', 'particleText', current_x, BASE_Y + 10, GUI_INPUT_WIDTH);
    particleCountInput = createInput(N_PARTICLES.toString(), 'number')
        .position(current_x, BASE_Y + 45)
        .style(INPUT_STYLE);

    current_x += GUI_INPUT_WIDTH + GUI_SPACING;

    createButton('Zastosuj').id('applyButton')
        .position(current_x, BASE_Y + 45)
        .mousePressed(updateParticleCount)
        .style(BUTTON_STYLE)
        .style('background', COLOR_ION);

    defineLayout();
}

function drawGUIArea() {
    fill(COLOR_BACKGROUND);
    rect(0, 0, width, GUI_TOP_HEIGHT);
    rect(0, height - GUI_BOTTOM_HEIGHT, width, GUI_BOTTOM_HEIGHT);

    eFieldButton.style('background', E_FIELD_X !== 0 ? COLOR_ACCENT : COLOR_ION);
    eFieldButton.html(E_FIELD_X !== 0 ? 'POLE E (WŁ.)' : 'POLE E (WYŁ.)');

    select('#eFieldText').html(`Wartość Pola E: ${eFieldSlider.value().toFixed(2)}`);
    select('#tempText').html(`Czas Relaksacji (τ): ${TAU}`);

    const new_tau = tempSlider.value();
    const max_tau = 50;
    const min_tau = 5;
    const noise_range_E = 0.2; 
    const noise_range_I = 0.003;

    const normalized_temp = map(new_tau, min_tau, max_tau, 1, 0);

    ELECTRON_THERMAL_NOISE = 0.01 + normalized_temp * noise_range_E; 
    THERMAL_NOISE_MULTIPLIER = 0.0005 + normalized_temp * noise_range_I;
    TAU = new_tau;
}

function toggleEField() {
    if (E_FIELD_X === 0) {
        current_e_field = eFieldSlider.value();
        E_FIELD_X = current_e_field;
        trajectory = [];
    } else {
        E_FIELD_X = 0;
        trajectory = [];
    }
}

function updateEField() {
    if (E_FIELD_X !== 0) {
        E_FIELD_X = eFieldSlider.value();
    }
}

function updateTemperature() {
    trajectory = [];
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
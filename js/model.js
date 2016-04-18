var W99_DEFAULT = {}
W99_DEFAULT.cc0 =  1.50; //Standstill Distance - m
W99_DEFAULT.cc1 =  1.30; //Headway Time - second
W99_DEFAULT.cc2 =  4.00; //Following Variation ("max drift") - m
W99_DEFAULT.cc3 =-12.00; //Threshold for Entering 'Following' - s
W99_DEFAULT.cc4 = -0.25; //Negative 'Following' Threshold - m/s
W99_DEFAULT.cc5 =  0.35; //Positive 'Following' Threshold - m/s
W99_DEFAULT.cc6 = 11.44/17000; //Speed Dependency of Oscillation - 10^-4 rad/s
W99_DEFAULT.cc7 =  0.25; //Oscillation Acceleration - m/s^2
W99_DEFAULT.cc8 =  2.00; //Standstill Acceleration - m/s^2
W99_DEFAULT.cc9 =  1.50; //Acceleration at 80km/h - m/s^2

const CAR_WIDTH = 1.8; //m
const CAR_LENGTH = 4.5; //m
var CAR_COLOR = ["SlateBlue", "Crimson", "BlueViolet", "Black", "Magenta",
                 "DarkOrange", "cadetblue", "deepskyblue", "darksalmon", "goldenrod"];
const N_CAR_MAX = 12;

const DISPLAY_RESOLUTION = 10;
const SIMULATION_RESOLUTION = 10;

function w99(w99_parameters){
  this.parameters = w99_parameters;
  this.cars = [];
  this.interval_handle;

}

w99.prototype.addCar = function(color, seed, x, v, a, v_desired) {
    var car = {}
    car.width = CAR_WIDTH;
    car.length = CAR_LENGTH;
    car.color = color;
    car.seed = seed; //a random seed for driving aggressiveness
    car.x = x;
    car.v = v;
    car.a = a;
    car.v_desired = v_desired;
    car.status = {}

    this.cars.push(car); //push to the begining
}

w99.prototype.setCars = function(n, headway){
    var x0 = 0;
    for (var i = 0; i < n; i++) {
      this.addCar(CAR_COLOR[i], 42+i, x0+i*headway, 0, 0, 60);
    }
}

w99.prototype.reset = function() {}

w99.prototype.simRunContinous = function() {
  this.simPause();
  var this_pointer = this;  //have to use a closure with an explicit reference
  this.interval_handle = setInterval(function(){this_pointer.nextStep();}, 1000/DISPLAY_RESOLUTION);
}

w99.prototype.simRunStep = function() {
  this.simPause();
  this.nextStep();
}

w99.prototype.simPause = function() {
  clearInterval(this.interval_handle);
}

w99.prototype.simStop = function() {
  //Pause + Clear
}

w99.prototype.nextStep = function() {
  if (this.cars.length <= 0) {return} // # of car must > 0

  var dt = 1/SIMULATION_RESOLUTION;
  this.calculateCarStatus(dt); //calculate next step
  drawAll(this.cars);
  updateCarStatus(this.cars, this.parameters);
}

w99.prototype.calculateCarStatus = function(dt) {
  var n = this.cars.length;

  for (var i = 0; i < n; i++) {
    this.cars[i].v += this.cars[i].a * dt;
    this.cars[i].v = Math.max(this.cars[i].v, 0); //v can't be negative
    this.cars[i].x += this.cars[i].v * dt;

    i_leader = (i !== n-1)? i+1: 0;
    w99_results = this.carFollowing(this.cars[i_leader], this.cars[i]);
    this.cars[i].a = w99_results[0];
    this.cars[i].status = w99_results[1];
  }
}

w99.prototype.carFollowing = function(leader, follower) {
  var cc0 = this.parameters.cc0;
  var cc1 = this.parameters.cc1;
  var cc2 = this.parameters.cc2;
  var cc3 = this.parameters.cc3;
  var cc4 = this.parameters.cc4;
  var cc5 = this.parameters.cc5;
  var cc6 = this.parameters.cc6;
  var cc7 = this.parameters.cc7;
  var cc8 = this.parameters.cc8;
  var cc9 = this.parameters.cc9;

  var dx = leader.x - follower.x - leader.length;
  if (dx < 0) {dx += 2*Math.PI*TRACK_RADIUS}
  var dv = leader.v - follower.v;
  //var ax = leader.length + cc0; //desired distance between two stationary vehs

  if (leader.v <= 0) {
    var sdxc = cc0;
  } else {
    var v_slower = ((dv >= 0) | (leader.a < -1))? follower.v : leader.v + dv*(simpleRandom(follower.seed) - 0.5);
    var sdxc = cc0 + cc1*v_slower; //minumum following distance considered safe by driver
  }
  var sdxo = sdxc + cc2; //maximum following distance (upper limit of car-following process)
  var sdxv = sdxo + cc3*(dv-cc4);

  var sdv = cc6*dx*dx; //distance driver starts perceiving speed differences when approaching slower leader
  var sdvc = (leader.v > 0)? cc4 - sdv : 0; //minimum closing dv
  var sdvo = (follower.v > cc5)? sdv + cc5: sdv; //minimum opening dv

  var follower_a = 0; //new a to be returned
  var follower_status = {}; //new status to be returned
  follower_status.dx = dx;
  follower_status.dv = dv;
  follower_status.sdxc = sdxc;
  follower_status.sdxv = sdxv;
  follower_status.sdxo = sdxo;
  follower_status.sdvc = sdvc;
  follower_status.sdvo = sdvo;

  if ((dv < sdvo) && (dx <= sdxc)) {
    follower_status.text = 'Decelerate - Increase Distance';
    follower_status.code = 'A';
    follower_a = 0;
    if (follower.v > 0) {
      if (dv < 0){
        if (dx > cc0){
          follower_a = Math.min(leader.a + dv*dv/(cc0 - dx), follower.a);
        } else {
          follower_a = Math.min(leader.a + 0.5*(dv - sdvo), follower.a);
        }
      }
      if (follower_a > -cc7) {
        follower_a = -cc7;
      } else {
        follower_a = Math.max(follower_a, -10 + 0.5*Math.sqrt(follower.v));
      }
    }

  } else if ((dv<sdvc) && (dx<sdxv)){
    follower_status.text = 'Decelerate - Decrease Distance';
    follower_status.code = 'B';
    //follower_a = Math.max(0.5*dv*dv/(-dx+sdxc-0.1), -10 + Math.sqrt(follower.v));
    follower_a = Math.max(0.5*dv*dv/(-dx+sdxc-0.1), -10); //Capped by G
    //0.5*dv*dv/(-dx+sdxc-0.1) - necessary a to stop v*v/2x
    //-10 + Math.sqrt(follower.v) - realistic? no? higher v higher a?

  } else if ((dv<sdvo) && (dx<sdxo)){
    follower_status.text = 'Accelerate/Decelerate - Keep Distance';
    follower_status.code = 'f';
    if (follower.a <= 0) {
      follower_a = Math.min(follower.a, -cc7);
    } else {
      follower_a = Math.max(follower.a, cc7);
      //if (follower.length >= 6.5) {follower_a *= 0.5}
      follower_a = Math.min(follower_a, follower.v_desired - follower.v);
    }

  } else {
    follower_status.text = 'Accelerate/Relax - Increase/Keep Speed';
    follower_status.code = 'w';
    if (dx > sdxc){
      if (follower.status === 'w') {
        follower_a = cc7;
      } else {
        a_max = cc8 + cc9*Math.min(follower.v, 80*1000/3600) + simpleRandom(follower.seed); //capped at 80km/h
        if (dx < sdxo){
          follower_a = Math.min(dv*dv/(sdxo-dx), a_max);
        } else {
          follower_a = a_max;
        }
      }
      //if (follower.length >= 6.5) {follower_a *= 0.5}
      follower_a = Math.min(follower_a, follower.v_desired - follower.v);
    }
  }
  return [follower_a, follower_status];
}

function simpleRandom(seed){
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
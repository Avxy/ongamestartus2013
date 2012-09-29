/*
 *
 * Character.js
 * Adds additional functionality to basic model.
 *
 * @author Collin Hover / http://collinhover.com/
 *
 */
(function (main) {
    
    var shared = main.shared = main.shared || {},
		assetPath = "js/game/characters/Character.js",
		_Character = {},
		_Model,
		_Actions,
		_MathHelper,
		_VectorHelper,
		characterName = 'Character';
	
	/*===================================================
    
    public properties
    
    =====================================================*/
	
	main.asset_register( assetPath, { 
		data: _Character,
		requirements: [
			"js/game/core/Model.js",
			"js/game/core/Actions.js",
			"js/game/utils/MathHelper.js",
			"js/game/utils/VectorHelper.js"
		],
		callbacksOnReqs: init_internal,
		wait: true
	});
	
	/*===================================================
    
    internal init
    
    =====================================================*/
	
	function init_internal ( m, ac, mh, vh ) {
		console.log('internal Character', _Character);
		// modules
		
		_Model = m;
		_Actions = ac;
		_MathHelper = mh;
		_VectorHelper = vh;
		
		// character instance
		
		_Character.Instance = Character;
		_Character.Instance.prototype = new _Model.Instance();
		_Character.Instance.prototype.constructor = _Character.Instance;
		
		_Character.Instance.prototype.move_state_change = move_state_change;
		_Character.Instance.prototype.rotate_by_direction = rotate_by_direction;
		_Character.Instance.prototype.rotate_by_angle = rotate_by_angle;
		_Character.Instance.prototype.stop_jumping = stop_jumping;
		_Character.Instance.prototype.morph_cycle = morph_cycle;
		
		_Character.Instance.prototype.update = update;
		
		Object.defineProperty( _Character.Instance.prototype, 'moving', { 
			get : function () { return this.movement.state.moving; }
		});
		
		Object.defineProperty( _Character.Instance.prototype, 'movingHorizontal', { 
			get : function () { return this.movement.state.movingHorizontal; }
		});
		
		Object.defineProperty( _Character.Instance.prototype, 'jumping', { 
			get : function () { return this.movement.jump.active; }
		});
		
		Object.defineProperty( _Character.Instance.prototype, 'turn', { 
			get : function () { return this.movement.rotate.turn; }
		});
		
	}
	
	/*===================================================
    
    character
    
    =====================================================*/
	
	// adds functionality to and inherits from Model
	
	function Character ( parameters ) {
		
		var parametersModel,
			parametersMovement,
			movement,
			move,
			rotate,
			jump,
			state;
		
		// handle parameters
		
		parameters = parameters || {};
		
		// model
		
		parametersModel = parameters.model || {};
		
		// physics
		
		if ( typeof parametersModel.physics !== 'undefined' ) {
			
			parametersModel.physics.dynamic = true;
			parametersModel.physics.movementDamping = parametersModel.physics.movementDamping || 0.5;
			
		}
		
		// prototype constructor
		
		_Model.Instance.call( this, parametersModel );
		
		// movement
		
		parametersMovement = parameters.movement || {};
		
		movement = this.movement = {};
		
		// move
		
		move = movement.move = {};
		move.speed = parametersMovement.moveSpeed || 3;
		move.speedBack = parametersMovement.moveSpeedBack || move.speed;
		move.runThreshold = parametersMovement.moveRunThreshold || 0;
		move.walkAnimationTime = parametersMovement.moveWalkAnimationTime || 750;
		move.runAnimationTime = parametersMovement.moveRunAnimationTime || 500;
		move.idleAnimationTime = parametersMovement.moveIdleAnimationTime || 3000;
		move.morphClearTime = parametersMovement.moveCycleClearTime || 125;
		move.animationChangeTimeThreshold = parametersMovement.animationChangeTimeThreshold || 0;
		move.animationChangeTimeTotal = move.animationChangeTimeThreshold;
		move.direction = new THREE.Vector3();
		move.vector = new THREE.Vector3();
		
		// rotate
		rotate = this.movement.rotate = {};
		rotate.lerpDelta = parametersMovement.rotateLerpDelta || 1;
		rotate.direction = new THREE.Vector3( 0, 0, 1 );
		rotate.directionLast = rotate.direction.clone();
		rotate.turnAngle = 0;
		rotate.turn = new THREE.Quaternion();
		rotate.turnSpeed = parametersMovement.rotateTurnSpeed || 0.025;
		rotate.directionAngle = 0;
		rotate.axis = new THREE.Vector3( 0, 1, 0 );
		rotate.delta = new THREE.Quaternion();
		rotate.vector = new THREE.Quaternion();
		
		// jump
		jump = this.movement.jump = {};
		jump.speedStart = parametersMovement.jumpSpeedStart || move.speed * ( 4 / 3 );
		jump.speedEnd = parametersMovement.jumpSpeedEnd || 0;
		jump.timeTotal = 0;
		jump.timeMax = parametersMovement.jumpTimeMax || 100;
		jump.timeAfterNotGrounded = 0;
		jump.timeAfterNotGroundedMax = 125;
		jump.startDelay = parametersMovement.jumpStartDelay || 125;
		jump.startDelayTime = 0;
		jump.animationTime = parametersMovement.jumpAnimationTime || 1000;
		jump.startAnimationTime = parametersMovement.jumpStartAnimationTime || jump.startDelay;
		jump.endAnimationTime = parametersMovement.jumpEndAnimationTime || move.morphClearTime;
		jump.ready = true;
		jump.active = false;
		
		// state
		state = this.movement.state = {};
		state.up = 0;
		state.down = 0;
		state.left = 0;
		state.right = 0;
		state.forward = 0;
		state.back = 0;
		state.moving = false;
		state.movingHorizontal = false;
		state.movingBack = false;
		state.moveType = '';
		
		// properties
		
		this.name = parameters.name || characterName;
		this.targeting = {
			
			targets: [],
			targetsToRemove: [],
			targetCurrent: undefined
			
		};
		
		this.actions = new _Actions.Instance();
		
	}
	
	/*===================================================
	
	move
	
	=====================================================*/
	
	function move_state_change ( propertyName, stop ) {
		
		var movement = this.movement,
			state = movement.state,
			rotate = movement.rotate,
			rotateDirection = rotate.direction,
			forwardBack;
		
		// handle state property
		
		if ( state.hasOwnProperty( propertyName ) ) {
			
			state[ propertyName ] = stop === true ? 0 : 1;
			
		}
		
		// rotation
		
		if ( state.forward === 1 ) {
			
			rotateDirection.z = 1;
			rotateDirection.x = 0;
			forwardBack = true;
			
		}
		else if ( state.back === 1 ) {
			
			rotateDirection.z = -1;
			rotateDirection.x = 0;
			forwardBack = true;
			
		}
		
		if ( state.left === 1 || state.right === 1 ) {
			
			rotateDirection.x = state.left - state.right;
			
			if ( forwardBack !== true ) {
				
				rotateDirection.z = 0;
				
			}
			else {
				
				rotateDirection.normalize();
				
			}
			
		}
		
	}
	
	/*===================================================
	
	rotate
	
	=====================================================*/
	
	function rotate_by_direction ( dx, dy, dz ) {
		
		var rotate = this.movement.rotate;
		
		// update direction
		
		if ( main.is_number( dx ) ) {
			
			rotate.direction.x = dx;
			
		}
		
		if ( main.is_number( dy ) ) {
			
			rotate.direction.y = dy;
			
		}
		
		if ( main.is_number( dz ) ) {
			
			rotate.direction.z = dz;
			
		}
		
	}
	
	function rotate_by_angle ( rotateAngleDelta ) {
		
		var rotate = this.movement.rotate,
			rotateAxis = rotate.axis,
			rotateDelta = rotate.delta,
			rotateAngleTarget = _MathHelper.degree_between_180( rotate.directionAngle + rotateAngleDelta ),
			rotateAngleDeltaShortest = _MathHelper.shortest_rotation_between_angles( rotate.directionAngle, rotateAngleTarget );
		
		// find delta quaternion
		
		rotateDelta.setFromAxisAngle( rotateAxis, rotateAngleDeltaShortest );
		
		// copy deltas
		
		rotateDelta.multiplyVector3( rotate.direction );
		rotate.directionAngle = rotateAngleTarget;
		
	}
	
	/*===================================================
	
	jump
	
	=====================================================*/
	
	function stop_jumping () {
		
		this.movement.jump.active = false;
		
	}
	
	/*===================================================
	
	morph cycling
	
	=====================================================*/
	
	function morph_cycle ( timeDelta, cycleType, duration, loop, reverse ) {
		
		var morphs = this.morphs,
			movement = this.movement,
			move = movement.move,
			state = movement.state;
		
		if ( state.moveType !== cycleType ) {
			
			if ( move.animationChangeTimeTotal < move.animationChangeTimeThreshold ) {
				
				move.animationChangeTimeTotal += timeDelta;
				
			}
			else {
				
				move.animationChangeTimeTotal = 0;
				
				morphs.clear( state.moveType, move.morphClearTime );
				
				state.moveType = cycleType;
				
			}
			
		}
		
		morphs.play( state.moveType, { duration: duration, loop: loop, reverse: reverse } );
		
	}
	
	/*===================================================
	
	update
	
	=====================================================*/
	
	function update ( timeDelta, timeDeltaMod ) {
		
		var rigidBody = this.rigidBody,
			morphs = this.morphs,
			movement = this.movement,
			move = movement.move,
			rotate = movement.rotate,
			jump = movement.jump,
			state = movement.state,
			moveDir = move.direction,
			moveVec = move.vector,
			moveSpeed = move.speed * timeDeltaMod,
			moveSpeedBack = move.speedBack * timeDeltaMod,
			moveSpeedRatio = Math.min( 1, ( moveSpeedBack / moveSpeed ) * 2 ),
			moveSpeedPct = Math.min( 1, ( moveVec.length() / moveSpeed ) ),
			rotateTurnAngleDelta,
			rotateDirectionAngleDelta,
			rotateDirectionAngleDeltaShortest,
			rotateDirectionAngleTarget,
			rotateAxis = rotate.axis,
			rotateDirection = rotate.direction,
			rotateDirectionLast = rotate.directionLast,
			rotateDelta = rotate.delta,
			rotateLerpDelta = rotate.lerpDelta * timeDeltaMod,
			jumpSpeedStart,
			jumpSpeedEnd,
			jumpTimeTotal,
			jumpTimeMax,
			jumpTimeRatio,
			jumpTimeAfterNotGroundedMax,
			jumpStartDelay,
			grounded,
			velocityGravity,
			velocityGravityForce,
			velocityMovement,
			velocityMovementForce,
			velocityMovementForceLength,
			velocityMovementDamping,
			dragCoefficient,
			terminalVelocity,
			playSpeedModifier;
		
		// set moving
				
		if ( state.forward === 1 || state.back === 1 || state.left === 1 || state.right === 1 ) {
			
			state.movingHorizontal = true;
			
		}
		else {
			
			state.movingHorizontal = false;
			
		}
		
		if ( state.movingHorizontal || state.up === 1 || state.down === 1 ) {
			
			state.moving = true;
			
		}
		else {
			
			state.moving = false;
			
		}
		
		// update movement
		
		moveDir.z = state.movingHorizontal ? 1 : 0;
		
		// update rotation angles
		
		rotateTurnAngleDelta = ( state.left - state.right ) * rotate.turnSpeed;
		rotateDirectionAngleDelta = _VectorHelper.signed_angle_between_coplanar_vectors( rotateDirectionLast, rotateDirection, rotateAxis ) * rotateLerpDelta;
		
		// if moving
		
		if ( state.movingHorizontal === true ) {
			
			// rotate by turn angle change
			
			if ( rotateTurnAngleDelta !== 0 ) {
				
				rotateDelta.setFromAxisAngle( rotateAxis, rotateTurnAngleDelta );
				
				this.quaternion.multiplySelf( rotateDelta );
				
				// copy new turn angle
				
				rotate.turn.multiplySelf( rotateDelta );
				rotate.turnAngle = _MathHelper.degree_between_180( rotate.turnAngle + rotateTurnAngleDelta );
				
			}
			
			// rotate by direction angle change
			
			if ( rotateDirectionAngleDelta !== 0 ) {
				
				rotateDirectionAngleTarget = _MathHelper.degree_between_180( rotate.directionAngle + rotateDirectionAngleDelta );
				rotateDirectionAngleDeltaShortest = _MathHelper.shortest_rotation_between_angles( rotate.directionAngle, rotateDirectionAngleTarget );
				rotateDelta.setFromAxisAngle( rotateAxis, rotateDirectionAngleDeltaShortest );
				
				this.quaternion.multiplySelf( rotateDelta );
				
				// copy new direction angle
				
				rotateDelta.multiplyVector3( rotateDirectionLast );
				rotate.directionAngle = rotateDirectionAngleTarget;
				
			}
			
		}
		
		// velocity
		
		if ( typeof rigidBody !== 'undefined' ) {
			
			// properties
			
			velocityMovement = rigidBody.velocityMovement;
			velocityMovementForce = velocityMovement.force;
			velocityGravity = rigidBody.velocityGravity;
			velocityGravityForce = velocityGravity.force;
			
			jumpTimeTotal = jump.timeTotal;
			jumpTimeMax = jump.timeMax;
			jumpTimeAfterNotGroundedMax = jump.timeAfterNotGroundedMax;
			jumpStartDelay = jump.startDelay;
			jumpSpeedStart = jump.speedStart * timeDeltaMod;
			jumpSpeedEnd = jump.speedEnd * timeDeltaMod;
			
			// movement basics
			
			moveVec.copy( moveDir );
			moveVec.x *= moveSpeed;
			moveVec.y *= moveSpeed;
			
			if ( moveDir.z < 0 ) {
				
				moveVec.z *= moveSpeedBack;
				
				jumpSpeedStart *= moveSpeedRatio;
				jumpSpeedEnd *= moveSpeedRatio;
				
			}
			else if ( jump.active === true ) {
				
				moveVec.z *= ( moveSpeed + jumpSpeedStart ) * 0.5;
				
			}
			else {
				
				moveVec.z *= moveSpeed;
				
			}
			
			// handle jumping
			
			grounded = rigidBody.grounded;
			
			jump.timeAfterNotGrounded += timeDelta;
			
			// if falling but not jumping
			
			if ( jump.active === false && jump.timeAfterNotGrounded >= jumpTimeAfterNotGroundedMax && grounded === false ) {
				
				jump.ready = false;
				
				this.morph_cycle( timeDelta, 'jump', jump.animationTime, true );
				
			}
			// do jump
			else if ( state.up !== 0 && ( grounded === true || jump.timeAfterNotGrounded < jumpTimeAfterNotGroundedMax ) && jump.ready === true ) {
				
				jump.timeTotal = 0;
				
				jump.startDelayTime = 0;
				
				jump.ready = false;
				
				jump.active = true;
				
				jump.starting = true;
				
			}
			else if ( jump.active === true && jump.timeTotal < jumpTimeMax ) {
				
				// count delay
				
				jump.startDelayTime += timeDelta;
				
				// do jump after delay
				
				if ( jump.startDelayTime >= jump.startDelay ) {
					
					// if start delay just finished
					
					if ( jump.starting === true ) {
						
						jump.starting = false;
					
						// reset velocity
						
						velocityGravityForce.y  = 0;
						
					}
					
					// play jump
					
					this.morph_cycle ( timeDelta, 'jump', jump.animationTime, true );
					
					// properties
					
					jumpTimeRatio = jumpTimeTotal / jumpTimeMax;
					
					// update time total
					
					jump.timeTotal += timeDelta;
					
					// add speed to gravity velocity
					
					velocityGravityForce.y += jumpSpeedStart * ( 1 - jumpTimeRatio) + jumpSpeedEnd * jumpTimeRatio;
					
				}
				else {
					
					// play jump start
					
					morphs.play( 'jump_start', { duration: jump.startAnimationTime, loop: false, callback: function () { morphs.clear( 'jump_start' ); } } );
					
				}
				
			}
			else {
				
				if ( grounded === true && jump.active !== false ) {
					
					this.stop_jumping();
					
					if ( jump.timeAfterNotGrounded >= jumpTimeAfterNotGroundedMax ) {
						
						morphs.clear( 'jump', move.morphClearTime );
					
						morphs.play( 'jump_end', { duration: jump.endAnimationTime, loop: false, callback: function () { morphs.clear( 'jump_end', move.morphClearTime ); } } );
					
					}
					
				}
				
				if ( grounded === true && state.up === 0 ) {
					
					jump.timeAfterNotGrounded = 0;
					
					jump.ready = true;
					
				}
				
			}
			
			// add move vec to rigidBody movement
			
			velocityMovementForce.addSelf( moveVec );
			
			// moving backwards?
			
			if ( velocityMovementForce.z < 0 ) {
				
				state.movingBack = true;
				
			}
			else if ( velocityMovementForce.z > 0 ) {
				
				state.movingBack = false;
				
			}
			
			// get movement force
			
			velocityMovementForceLength = velocityMovementForce.length() / timeDeltaMod;
			
			// walk/run/idle
			
			if ( jump.active === false && grounded === true ) {
				
				// walk / run cycles
				
				if ( velocityMovementForceLength > 0 ) {
					
					// get approximate terminal velocity based on acceleration (moveVec) and damping
					// helps morphs play faster if character is moving faster, or slower if moving slower
					// TODO: move equation into physics module
					
					velocityMovementDamping = velocityMovement.damping.z;
					dragCoefficient = ( 0.33758 * Math.pow( velocityMovementDamping, 2 ) ) + ( -0.67116 * velocityMovementDamping ) + 0.33419;
					terminalVelocity = Math.round( Math.sqrt( ( 2 * Math.abs( moveVec.z * 0.5 ) ) / dragCoefficient ) );
					playSpeedModifier = terminalVelocity / Math.round( velocityMovementForceLength );
					
					if ( velocityMovementForceLength > move.runThreshold ) {
						
						this.morph_cycle ( timeDelta, 'run', move.runAnimationTime * playSpeedModifier, true, state.movingBack );
						
					}
					else {
						
						this.morph_cycle ( timeDelta, 'walk', move.walkAnimationTime * playSpeedModifier, true, state.movingBack );
						
					}
					
				}
				// idle cycle
				else {
					
					this.morph_cycle ( timeDelta, 'idle', move.idleAnimationTime, true, false );
					
				}
				
			}
			
		}
		
	}
	
} ( OGSUS ) );
/*
 *
 * Physics.js
 * Simple raycasting based physics using octree for faster casting.
 *
 * @author Collin Hover / http://collinhover.com/
 *
 */
(function (main) {
    
    var shared = main.shared = main.shared || {},
		assetPath = "js/game/physics/Physics.js",
		_Physics = {},
		_RigidBody,
		_RayHelper,
		_MathHelper,
		_VectorHelper,
		_ObjectHelper,
		_PhysicsHelper,
		scaleSpeedExp = Math.log( 1.5 );
	
	/*===================================================
    
    public properties
    
    =====================================================*/
	
	main.asset_register( assetPath, { 
		data: _Physics,
		requirements: [
			"js/game/physics/RigidBody.js",
			"js/game/utils/MathHelper.js",
			"js/game/utils/VectorHelper.js",
			"js/game/utils/RayHelper.js",
			"js/game/utils/ObjectHelper.js",
			"js/game/utils/PhysicsHelper.js",
			"js/lib/three/ThreeOctree.min.js"
		],
		callbacksOnReqs: init_internal,
		wait: true
	});
	
	/*===================================================
    
    internal init
    
    =====================================================*/
	
	function init_internal ( rb, mh, vh, rh, oh, ph ) {
		console.log('internal physics');
		
		_RigidBody = rb;
		_MathHelper = mh;
		_VectorHelper = vh;
		_RayHelper = rh;
		_ObjectHelper = oh;
		_PhysicsHelper = ph;
		
		// properties
		
		_Physics.timeWithoutIntersectionThreshold = 500;
		
		// instance
		
		_Physics.Instance = Physics;
		_Physics.Instance.prototype = {};
		_Physics.Instance.prototype.constructor = _Physics.Instance;
		
		_Physics.Instance.prototype.add = add;
		_Physics.Instance.prototype.remove = remove;
		_Physics.Instance.prototype.modify_bodies = modify_bodies;
		_Physics.Instance.prototype.update = update;
		_Physics.Instance.prototype.handle_velocity = handle_velocity;
		
	}
	
	/*===================================================
    
	instance
    
    =====================================================*/
	
	function Physics ( parameters ) {
		
		// handle parameters
		
		parameters = parameters || {};
		
		// shared
		
		shared.universeGravitySource = parameters.universeGravitySource instanceof THREE.Vector3 ? parameters.universeGravitySource : shared.universeGravitySource;
		shared.universeGravityMagnitude = parameters.universeGravityMagnitude instanceof THREE.Vector3 ? parameters.universeGravityMagnitude : shared.universeGravityMagnitude;
		
		// util
		
		this.utilVec31Update = new THREE.Vector3();
		this.utilVec32Update = new THREE.Vector3();
		this.utilVec33Update = new THREE.Vector3();
		this.utilVec34Update = new THREE.Vector3();
		this.utilVec35Update = new THREE.Vector3();
		this.utilVec31Velocity = new THREE.Vector3();
		
		// octree
		
		this.octree = new THREE.Octree();
		
		// properties
		
		this.timeWithoutIntersectionThreshold = main.is_number( parameters.timeWithoutIntersectionThreshold ) ? parameters.timeWithoutIntersectionThreshold : _Physics.timeWithoutIntersectionThreshold;
		
		this.bodies = [];
		this.bodiesGravity = [];
		this.bodiesDynamic = [];
		
	}
	
	/*===================================================
    
	add / remove
    
    =====================================================*/
	
	function add ( object ) {
		
		this.modify_bodies( object, true );
		
	}
	
	function remove( object ) {
		
		this.modify_bodies( object );
		
	}
	
	function modify_bodies ( object, adding ) {
		
		var i, l,
			rigidBody,
			collider,
			index,
			child;
		
		if ( typeof object !== 'undefined' ) {
			
			if ( typeof object.rigidBody !== 'undefined' ) {
				
				rigidBody = object.rigidBody;
				
				collider = rigidBody.collider;
				
				// zero out velocities
				
				rigidBody.velocityMovement.force.set( 0, 0, 0 );
				
				rigidBody.velocityGravity.force.set( 0, 0, 0 );
				
				// get indices
				
				index = main.index_of_value( this.bodies, rigidBody );
				
				// if adding
				
				if ( adding === true ) {
					
					// bodies
					
					if ( index === -1 ) {
						
						this.bodies.push( rigidBody );
						
					}
					
					// gravity bodies
					
					if ( rigidBody.gravitySource === true ) {
					
						index = main.index_of_value( this.bodiesGravity, rigidBody );
						
						if ( index === -1 ) {
							
							this.bodiesGravity.push( rigidBody );
							
							rigidBody.mesh.morphs.play( 'idle', { loop: true, startDelay: true } );
							
						}
						
					}
					
					// dynamic body
					
					if ( rigidBody.dynamic === true ) {
						
						index = main.index_of_value( this.bodiesDynamic, rigidBody );
						
						if ( index === -1 ) {
							
							this.bodiesDynamic.push( rigidBody );
							
						}
						
					}
					// static colliders in octree and split by faces if collider is mesh
					else {
						
						this.octree.add( object, collider instanceof _RayHelper.MeshCollider ? true : false );
						
					}
					
				}
				// default to remove
				else {
					
					// bodies
					
					if ( index !== -1 ) {
						
						this.bodies.splice( index, 1 );
						
					}
					
					// gravity bodies
					
					if ( rigidBody.gravitySource === true ) {
					
						index = main.index_of_value( this.bodiesGravity, rigidBody );
						
						if ( index === -1 ) {
							
							this.bodiesGravity.splice( index, 1 );
							
						}
						
					}
					
					// dynamic colliders
					
					if ( rigidBody.dynamic === true ) {
						
						index = main.index_of_value( this.bodiesDynamic, rigidBody );
						
						if ( index !== -1 ) {
							
							this.bodiesDynamic.splice( index, 1 );
							
						}
						
					}
					// static colliders in octree
					else {
						
						this.octree.remove( object );
						
					}
					
				}
				
			}
			
			// search for physics in children
			
			if ( typeof object.children !== 'undefined' ) {
				
				for ( i = 0, l = object.children.length; i < l; i++ ) {
					
					child = object.children[ i ];
					
					this.modify_bodies( child, adding );
					
				}
				
			}
			
		}
		
	}
	
	/*===================================================
    
    update
    
    =====================================================*/
	
	function update ( timeDelta, timeDeltaMod ) {
		
		var i, l,
			j, k,
			rigidBody,
			mesh,
			gravityOrigin = this.utilVec31Update,
			gravityMagnitude = this.utilVec32Update,
			gravityUp = this.utilVec33Update,
			velocityGravity,
			velocityGravityForceUpDir = this.utilVec34Update,
			velocityGravityForceUpDirRot = this.utilVec35Update,
			velocityMovement,
			safetynet;
		
		// dynamic bodies
		
		for ( i = 0, l = this.bodiesDynamic.length; i < l; i++ ) {
			
			rigidBody = this.bodiesDynamic[ i ];
			
			// properties
			
			mesh = rigidBody.mesh;
			
			velocityGravity = rigidBody.velocityGravity;
			
			velocityMovement = rigidBody.velocityMovement;
			
			safetynet = rigidBody.safetynet;
			
			gravityBody = rigidBody.gravityBody;
			
			// if has gravity body
			
			if ( gravityBody instanceof _RigidBody.Instance ) {
				
				gravityMesh = gravityBody.mesh;
				
				gravityOrigin.copy( gravityMesh.matrixWorld.getPosition() );
				
				gravityMagnitude.copy( rigidBody.gravityMagnitude || shared.universeGravityMagnitude );
				
			}
			// else use world gravity
			else {
				
				gravityOrigin.copy( shared.universeGravitySource );
				
				gravityMagnitude.copy( shared.universeGravityMagnitude );
				
			}
			
			gravityMagnitude.multiplyScalar( timeDeltaMod );
			
			// rotate to stand on source
			
			_PhysicsHelper.rotate_relative_to_source( mesh.quaternion, mesh.position, gravityOrigin, rigidBody.axes.up, rigidBody.axes.forward, rigidBody.lerpDelta, rigidBody );
			
			// movement velocity
			
			this.handle_velocity( rigidBody, velocityMovement );
			
			// find up direction
			
			gravityUp.sub( mesh.position, gravityOrigin ).normalize();
			
			// add non rotated gravity to gravity velocity
			
			velocityGravity.force.addSelf( gravityMagnitude );
			
			velocityGravity.relativeRotation = gravityUp;
			
			velocityGravityForceUpDir.copy( velocityGravity.force ).negate().normalize();
			
			velocityGravityForceUpDirRot = _VectorHelper.rotate_vector3_relative_to( velocityGravity.relativeRotation, velocityGravityForceUpDir, velocityGravityForceUpDirRot );
			
			// gravity velocity
			
			this.handle_velocity( rigidBody, velocityGravity );
			
			// update gravity body
			
			rigidBody.find_gravity_body( this.bodiesGravity, timeDelta );
			
			// post physics
			// TODO: correct safety net for octree and non-infinite rays
			
			/*
			
			// get velocity collisions
			
			velocityGravityCollision = velocityGravity.collision;
			velocityMovementCollision = velocityMovement.collision;
			
			// get velocity collision rigid bodies
			
			if ( velocityGravityCollision ) {
				velocityGravityCollisionRigidBody = velocityGravityCollision.object.rigidBody;
			}
			if ( velocityMovementCollision ) {
				velocityMovementCollisionRigidBody = velocityMovementCollision.object.rigidBody;
			}
			
			// get distance to current gravity body
			
			if ( gravityBody instanceof _RigidBody.Instance ) {
				
				gravityBodyDistance = gravityBodyDifference.sub( mesh.position, gravityMesh.position ).length();
				
			}
			else {
				
				gravityBodyDistance = Number.MAX_VALUE;
			
			}
			
			// if rigidBody is not safe
			if ( rigidBody.safe === false ) {
				
				// rescue rigidBody and set back to last safe
				
				mesh.position.copy( safetynet.position );
				
				if ( mesh.useQuaternion === true ) {
					
					mesh.quaternion.copy( safetynet.quaternion );
					
				}
				else {
					
					mesh.matrix.setRotationFromQuaternion( safetynet.quaternion );
					
				}
				
				velocityGravity.reset();
				velocityMovement.reset();
				
				rigidBody.safe = true;
				
				// safety net end
					
				rigidBody.onSafetyNetEnd.dispatch();
				
				shared.signals.physicssafetynetend.dispatch( rigidBody );
				
			}		
			// if velocity gravity force is moving towards source
			else if ( velocityGravityForceUpDirRot.equals( gravityUp ) ) {
				
				// if no intersection
				if ( gravityBodyDistance < rigidBody.radius * 0.5 && !velocityGravityCollision ) {
					console.log(' SAFETY NET: ', gravityBodyDistance, velocityGravityCollision );
					// set rigidBody to unsafe, but do not reset to safe position immediately
					// wait until next update to allow dispatched signals to be handled first
					
					rigidBody.safe = false;
					
					// safety net start
					
					if ( rigidBody.onSafetyNetStarted ) {
						
						rigidBody.onSafetyNetStarted.dispatch();
						
					}
					
					shared.signals.physicssafetynetstart.dispatch( rigidBody );
					
				}
				// rigidBody is safe
				else {
					
					velocityGravity.timeWithoutIntersection = velocityGravity.updatesWithoutIntersection = 0;
					
					rigidBody.safe = true;
					
					// copy last safe position and rotation into rigidBody
					
					safetynet.position.copy( mesh.position );
					
					if ( mesh.useQuaternion === true ) {
						
						safetynet.quaternion.copy( mesh.quaternion );
						
					}
					else {
						
						safetynet.quaternion.setFromRotationMatrix( mesh.matrix );
						
					}
					
				}
				
			}
			*/
		}
		
	}
	
	/*===================================================
    
    velocity functions
    
    =====================================================*/
	
	function handle_velocity ( rigidBody, velocity ) {
		
		var mesh = rigidBody.mesh,
			position = mesh.position,
			scale = mesh.scale,
			scaleModded = this.utilVec31Velocity.copy( scale ),
			velocityForce = velocity.force,
			velocityForceRotated = velocity.forceRotated,
			velocityForceRotatedLength,
			velocityForceScalar,
			velocityOffset = velocity.offset,
			velocityDamping = velocity.damping,
			relativeRotation = velocity.relativeRotation,
			boundingRadius,
			intersection,
			intersectionDist;
		
		if ( rigidBody.dynamic !== true || velocityForce.isZero() === true ) {
			
			velocity.moving = false;
			
			return;
			
		} 
		else {
			
			velocity.moving = true;
			
		}
		
		// if velocity is relative to rotation, else will just copy force into rotated
		
		velocityForceRotated = _VectorHelper.rotate_vector3_relative_to( relativeRotation, velocityForce, velocityForceRotated );
		
		// scale velocity
		
		scaleModded.x = Math.pow( scaleModded.x, scaleSpeedExp );
		scaleModded.y = Math.pow( scaleModded.y, scaleSpeedExp );
		scaleModded.z = Math.pow( scaleModded.z, scaleSpeedExp );
		
		velocityForceRotated.multiplySelf( scaleModded );
		
		// get rotated length
		
		velocityForceRotatedLength = velocityForceRotated.length();
		
		// get bounding radius
		//boundingRadius = rigidBody.radius;
		
		// get bounding radius in direction of velocity
		// more accurate than plain radius, but about 4x more cost
		boundingRadius = rigidBody.offset_in_direction( velocityForceRotated ).length();
		
		// rotate offset if needed
		
		if ( velocityOffset.length() > 0 ) {
			
			velocityOffset = _VectorHelper.rotate_vector3_to_mesh_rotation( mesh, velocityOffset );
			
		}
		
		// get intersection
		
		intersection = _RayHelper.raycast( {
			octree: this.octree,
			origin: position,
			direction: velocityForceRotated,
			offset: velocityOffset,
			far: velocityForceRotatedLength + boundingRadius,
			ignore: mesh
		} );
		
		// modify velocity based on intersection distances to avoid passing through or into objects
		
		if ( intersection ) {
			
			velocity.intersection = intersection;
			
			intersectionDist = intersection.distance;
			
			// set the rotated velocity to be no more than intersection distance
			
			if ( intersectionDist - velocityForceRotatedLength <= boundingRadius ) {
				
				velocityForceScalar = ( intersectionDist - boundingRadius ) / velocityForceRotatedLength;
				
				velocityForceRotated.multiplyScalar( velocityForceScalar );
				
				velocity.moving = false;
				
				velocity.collision = intersection;
				
			}
			
		}
		else {
			
			velocity.intersection = false;
			velocity.collision = false;
		
		}
		
		// add velocity to position
		
		position.addSelf( velocityForceRotated );
		
		// damp velocity
		
		velocityForce.multiplySelf( velocityDamping );
		
		// if velocity low enough, set zero
		
		if ( velocityForce.length() < 0.01 ) {
			velocityForce.multiplyScalar( 0 );
		}
		
		// return intersection
		
		return intersection;
	}
	
} ( OGSUS ) );
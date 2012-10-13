/*
 *
 * Scene.js
 * Extends basic scene with additional functionality.
 *
 * @author Collin Hover / http://collinhover.com/
 *
 */
(function (main) {
    
    var shared = main.shared = main.shared || {},
		assetPath = "js/game/core/Scene.js",
		_Scene = {},
		_SceneHelper,
		_Model,
		_Physics,
		_RigidBody;
    
    /*===================================================
    
    public properties
    
    =====================================================*/
	
	main.asset_register( assetPath, {
		data: _Scene,
		requirements: [
			"js/game/utils/SceneHelper.js",
			"js/game/core/Model.js",
			'js/game/physics/Physics.js',
			'js/game/physics/RigidBody.js'
		], 
		callbacksOnReqs: init_internal,
		wait: true
	} );
	
	/*===================================================
    
    internal init
    
    =====================================================*/
	
	function init_internal ( sh, mdl, physx, rb ) {
		console.log('internal scene', _Scene);
		
		// utility
		
		_SceneHelper = sh;
		_Model = mdl;
		_Physics = physx;
		_RigidBody = rb;
		
		// instance
		
		_Scene.Instance = Scene;
		_Scene.Instance.prototype = new THREE.Scene();
		_Scene.Instance.prototype.constructor = _Scene.Instance;
		_Scene.Instance.prototype.supr = THREE.Scene.prototype;
		
		_Scene.Instance.prototype.__addObject = __addObject;
		_Scene.Instance.prototype.__removeObject = __removeObject;
		
	}
	
	/*===================================================
    
    instance
    
    =====================================================*/
	
	function Scene ( parameters ) {
		
		// handle parameters
		
		parameters = parameters || {};
		
		// proto
		
		THREE.Scene.call( this );
		
		// physics
		
		this.physics = new _Physics.Instance();
		
	}
	
	/*===================================================
    
    add
    
    =====================================================*/
	
	function __addObject ( object ) {
		
		// proto
		
		_Scene.Instance.prototype.supr.__addObject.call( this, object );
		
		// if object is model
		
		if ( object instanceof _Model.Instance ) {
			
			// physics
			
			if ( object.rigidBody instanceof _RigidBody.Instance ) {
				
				this.physics.add( object );
				
			}
			
		}
		
	}
	
	/*===================================================
    
    remove
    
    =====================================================*/
	
	function __removeObject ( object ) {
		
		// proto
		
		_Scene.Instance.prototype.supr.__removeObject.call( this, object );
		
		// if object is model
		
		if ( object instanceof _Model.Instance ) {
			
			// stop morphs
			
			if ( typeof object.morphs !== 'undefined' ) {
				
				object.morphs.stop_all();
				
			}
			
			// physics
			
			if ( object.rigidBody instanceof _RigidBody.Instance ) {
				
				this.physics.remove( object );
				
			}
			
		}
		
	}
	
} (OGSUS) );
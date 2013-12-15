define(['platform','game','vector','staticcollidable','linesegment','editor','required','state','level','mouse','collision','keyboard','quake','resources','quadtree'],function(platform,Game,Vector,StaticCollidable,LineSegment,editor,required,state,level,mouse,collision,keyboard,quake,resources,QuadTree) {
	var t = new Vector(0,0);
	var t2 = new Vector(0,0);
	var rs = {
		'images': ['player','player_happy','patient','patient_happy',
		          ,'heart'
		          ,'person_business','person_lady','person_boy','person_guy',
		          ,'background','yousavedtheday','thanksforplaying'
		          ,'box64','box128','beam128','beam256','beam512','triangle64','stairs64'
		          ,'table','chair'],
		'audio': ['jump01','jump02','jump03','jump04',
				  'yay01','yay02','yay03','yay04','yay05','yay06','yay07',
				  'heart01','heart02','heart03','heart04',
				  'ouch01','ouch02','ouch03','ouch04','ouch05']
	};
	var angle_up = -Math.PI*0.5;
	var angle_right = 0;
	var angle_down = Math.PI*0.5;
	var angle_left = Math.PI;

	var black = '#111';
	var g,game;


Math.easeInOutCubic = function (t, b, c, d) {
	t /= d/2;
	if (t < 1) return c/2*t*t*t + b;
	t -= 2;
	return c/2*(t*t*t + 2) + b;
};

	platform.once('load',function() {
		var canvas = document.getElementById('main');
		window.game = game = g = new Game(startGame, canvas, [required(['chrome']),mouse,keyboard,resources(rs),state,level,collision,quake]);
		g.resources.status.on('changed',function() {
			g.graphics.context.clearRect(0,0,800,600);
			g.graphics.context.fillStyle = 'black';
			g.graphics.context.font = 'arial';
			g.graphics.fillCenteredText('Preloading ' + g.resources.status.ready + '/' + g.resources.status.total + '...',400,300);
		});
	});

	function startGame(err) {
	if (err) { console.error(err); }
	var images = g.resources.images;
	var audio = g.resources.audio;

	function pickRandom(arr) {
		return arr[(arr.length * Math.random()) | 0];
	}

	function list(o,prefix) {
		var arr = [];
		for(var k in o) {
			if (k.substr(0,prefix.length) === prefix) {
				arr.push(o[k]);
			}
		}
		return arr;
	}

	function randomPlayer(prefix) {
		var audios = list(audio,prefix);
		return function() {
			pickRandom(audios).play();
		};
	}

	var playYay = randomPlayer('yay');
	var playJump = randomPlayer('jump');
	var playHeart = randomPlayer('heart');
	var playOuch = randomPlayer('ouch');

	var nextUpdateQueue = [];
	function queueNextUpdate(f) {
		console.log('queue');
		nextUpdateQueue.push(f);
	}
	game.chains.update.unshift(function(dt,next) {
		var f;
		while(f = nextUpdateQueue.shift()) {
			f();
		}
		next(dt);
	});


	// Make all Box2D 'classes' global.
	for(var k in Box2D) {
		if (k.substr(0,2) === 'b2') {
			window[k] = Box2D[k];
		}
	}


	var listener = new b2ContactListener();

	Box2D.customizeVTable(listener, [{
		original: Box2D.b2ContactListener.prototype.BeginContact,
		replacement:
		function (thsPtr, contactPtr) {
			var contact = Box2D.wrapPointer( contactPtr, b2Contact );

			var fixtureA = contact.GetFixtureA();
			var bodyA = fixtureA.GetBody();

			var fixtureB = contact.GetFixtureB();
			var bodyB = fixtureB.GetBody();

			if (bodyA.instance && bodyA.instance.onBeginContact) {
				bodyA.instance.onBeginContact(bodyB.instance,contact);
			}
			if (bodyB.instance && bodyB.instance.onBeginContact) {
				bodyB.instance.onBeginContact(bodyA.instance,contact);
			}
		}
	}]);

	Box2D.customizeVTable(listener, [{
		original: Box2D.b2ContactListener.prototype.EndContact,
		replacement:
		function (thsPtr, contactPtr) {
			var contact = Box2D.wrapPointer( contactPtr, b2Contact );
			
			var fixtureA = contact.GetFixtureA();
			var bodyA = fixtureA.GetBody();

			var fixtureB = contact.GetFixtureB();
			var bodyB = fixtureB.GetBody();

			if (bodyA.instance && bodyA.instance.onEndContact) {
				bodyA.instance.onEndContact(bodyB.instance,contact);
			}
			if (bodyB.instance && bodyB.instance.onEndContact) {
				bodyB.instance.onEndContact(bodyA.instance,contact);
			}
		}
	}]);
	g.resetWorld = function() {
		g.world = new b2World(new b2Vec2(0.0, -50));
		
		game.world.SetContactListener(listener);
	};

	function createPolygonShape(vertices) {
	    var shape = new b2PolygonShape();            
	    var buffer = Box2D.allocate(vertices.length * 8, 'float', Box2D.ALLOC_STACK);
	    var offset = 0;
	    for (var i=0;i<vertices.length;i++) {
	        Box2D.setValue(buffer+(offset), vertices[i].get_x(), 'float'); // x
	        Box2D.setValue(buffer+(offset+4), vertices[i].get_y(), 'float'); // y
	        offset += 8;
	    }            
	    var ptr_wrapped = Box2D.wrapPointer(buffer, Box2D.b2Vec2);
	    shape.Set(ptr_wrapped, vertices.length);
	    return shape;
	}

	function createStaticBox(x,y,w,h,angle) {
		var body = game.world.CreateBody(new b2BodyDef());
		var shape = new b2PolygonShape();
		shape.SetAsBox(w/2,h/2);
		body.SetTransform(new b2Vec2(x,y), angle||0);
		var fixtureDef = new b2FixtureDef();
		fixtureDef.set_friction(1.0);
		fixtureDef.set_restitution(0);
		fixtureDef.set_shape(shape);
		body.CreateFixture(fixtureDef);
		return body;
	}
	function createStaticPolygon(vertices,x,y,angle) {
		var body = game.world.CreateBody(new b2BodyDef());
		var shape = createPolygonShape(vertices);
		body.SetTransform(new b2Vec2(x,y), angle||0);
		var fixtureDef = new b2FixtureDef();
		fixtureDef.set_friction(1.0);
		fixtureDef.set_restitution(0);
		fixtureDef.set_shape(shape);
		body.CreateFixture(fixtureDef);
		return body;
	}

	function createDynamicCircleBody(instance,x,y,r,angle) {
		var shape = new b2CircleShape();
		shape.set_m_radius(r);

		var bodyDef = new b2BodyDef();
		bodyDef.set_type(b2_dynamicBody);
		console.log(bodyDef);
		bodyDef.set_linearDamping(0.0);
		bodyDef.set_angularDamping(0.1);
		bodyDef.set_gravityScale(1.0);
		var body = game.world.CreateBody(bodyDef);
		body.instance = instance;

		var fixtureDef = new b2FixtureDef();
		fixtureDef.set_density(1.0);
		fixtureDef.set_friction(1.0);
		fixtureDef.set_restitution(0.0);
		fixtureDef.set_shape(shape);
		
		fixtureDef.instance = instance;
		body.radius = r;

		body.CreateFixture(fixtureDef);

		body.SetTransform(new b2Vec2(x, y), angle === undefined ? angle_up : angle);
		body.SetLinearVelocity(new b2Vec2(0,0));
		body.SetAwake(1);
		body.SetActive(1);
		return body;
	}

	// var body = world.GetBodyList();
	// while(body) {
	// 	var fixture = body.GetFixtureList();
	// 	while(fixture) {
	// 		if (fixture.GetType() === 0) {
	// 			fixture.GetShape();
	// 		}
	// 		fixture = fixture.GetNext();
	// 	}
	// 	body = body.GetNext();
	// }


	g.objects.lists.body = g.objects.createIndexList('body');
	g.objects.lists.shadow = g.objects.createIndexList('shadow');
	g.objects.lists.background = g.objects.createIndexList('background');
	g.objects.lists.foreground = g.objects.createIndexList('foreground');
	g.objects.lists.drawItem = g.objects.createIndexList('drawItem');

	g.objects.lists.player = g.objects.createIndexList('player');
	g.objects.lists.hasHeart = g.objects.createIndexList('hasHeart');
	g.objects.lists.needsHeart = g.objects.createIndexList('needsHeart');
	g.objects.lists.chair = g.objects.createIndexList('chair');

	// Auto-refresh
	(function() {
		var timeout = setTimeout(function() {
			document.location.reload(true);
		}, 3000);
		g.once('keydown',function() {
			disable();
		});
		g.once('mousemove',function() {
			disable();
		});
		g.chains.draw.push(draw);
		function draw(g,next) {
			g.fillStyle('#ff0000');
			g.fillCircle(800,0,30);
			g.fillStyle('black');
			next(g);
		}
		function disable() {
			clearTimeout(timeout);
			g.chains.draw.remove(draw);
		}
	})();

	// Camera
	(function() {
		game.camera = new Vector(0,0);
		game.camera.zoom = 1;
		game.camera.PTM = 32;
		game.camera.screenToWorld = function(screenV,out) {
			var ptm = getPixelsPerMeter();
			out.x = screenV.x / ptm + game.camera.x;
			out.y = -(screenV.y / ptm - game.camera.y);
		};
		game.camera.worldToScreen = function(worldV,out) {
			var ptm = getPixelsPerMeter();
			out.x = (worldV.x - game.camera.x) * ptm;
			out.y = (worldV.y - game.camera.y) * ptm * -1;
		};

		function getPixelsPerMeter() {
			return game.camera.PTM/game.camera.zoom;
		}
		var pattern;
		function drawCamera(g,next) {
			var ptm = getPixelsPerMeter();
			if (!pattern) {
				pattern = g.context.createPattern(images.background,'repeat');
			}

			var targetx = player.body.GetPosition().get_x()-800*0.5/ptm;
			var targety = player.body.GetPosition().get_y()+600*0.5/ptm;
			targetx += player.body.GetLinearVelocity().get_x() * 0.15;
			targety += player.body.GetLinearVelocity().get_y() * 0.15;

			var x = game.camera.x = 0.8*game.camera.x + 0.2*targetx;
			var y = game.camera.y = 0.8*game.camera.y + 0.2*targety;

			g.save();
			g.context.translate(-x*ptm,y*ptm);
			g.fillStyle(pattern);
			g.fillRectangle(x*ptm,-y*ptm,800,600);
			g.restore();

			g.save();
			g.context.scale(ptm,-ptm);
			g.context.lineWidth /= ptm;
			g.context.translate(-x,-y);
			next(g);
			g.restore();
		}
		g.chains.draw.camera = drawCamera;
		g.chains.draw.insertBefore(drawCamera,g.chains.draw.objects);

		function updateCamera(dt,next) {
			// Center on player
			// t.set(-player.position.x+400, -player.position.y+300);
			// var n = t;
			// var o = game.camera;
			// game.camera.set(n.x,o.y*0.05+n.y*0.95);
			next(dt);
		}
		g.chains.update.camera = updateCamera;
		g.chains.update.push(updateCamera);
		game.camera.set(0,0);
	})();

	// Touching
	(function() {
		g.objects.lists.touchable = g.objects.createIndexList('touchable');
		g.chains.update.push(function(dt,next) {
			g.objects.lists.touchable.each(function(ta) {
				g.objects.lists.touchable.each(function(tb) {
					if (ta.position.distanceToV(tb.position) <= ta.touchRadius+tb.touchRadius) {
						if (ta.touch) { ta.touch(tb); }
					}
				});
			});
			next(dt);		
		});
	})();

	// #editor
	function startEditor() {
		var items = [];
		var item = null;
		var angles = [
			{name:'up',a: angle_up},
			{name:'left',a: angle_left},
			{name:'down',a: angle_down},
			{name:'right',a: angle_right}
		];
		var angle = angles[0];
		setTimeout(function() {
			items = [
				Box64,Box128,Beam128,Beam256,Beam512,Triangle64,Stairs64,
				Table,Chair,PatientInNeed,PatientWithHeart
			];
			item = items[0];
		},1);

		var leveldef = [];

		function getPosition() {
			var tmp = new Vector();
			game.camera.screenToWorld(game.mouse,tmp);
			tmp.x = parseInt(tmp.x);
			tmp.y = parseInt(tmp.y);
			return tmp;
		}
		function place() {
			var p = getPosition();
			game.objects.add(new item(p.x,p.y,angle.a));
			leveldef.push('new ' + item.prototype.constructorName + '(' + p.x + ',' + p.y + ',' + 'angle_' + angle.name + ')');
			console.log(leveldef.join(',\n'));
		}
		g.on('mousedown',function(button) {
			if (button === 0) {
				place();
			} else if (button === 2) {
				var d = 1;
				angle = angles[((angles.indexOf(angle)+d) + angles.length) % angles.length];
			}
		});
		g.on('mousewheel',function(delta) {
			var d = delta > 0 ? 1 : -1;
			item = items[((items.indexOf(item)+d) + items.length) % items.length];
		});

		game.chains.draw.push(function(g,next) {
			next(g);
			
			var p = getPosition();

			g.fillCircle(p.x,p.y,0.1);

			g.strokeStyle('black');
			g.strokeLine(p.x,p.y,p.x+1,p.y-1);

			if (item) {
				g.context.globalAlpha = 0.5;
				item.prototype.draw.call({
					x: p.x,
					y: p.y,
					angle: angle.a,
					body: {
						GetPosition: function() {
							return {
								get_x: function() {
									return p.x;
								},
								get_y: function() {
									return p.y;
								}
							}
						},
						GetAngle: function() {
							return angle.a;
						}
					},
					image: item.prototype.image
				},g);
				g.context.globalAlpha = 1;
			}
		});
	};
	var editorStarted = false;
	game.on('keydown',function(button) {
		if (button === 'e' && !editorStarted) {
			editorStarted = true;
			startEditor();
		}
	});

	// Foreground and background
	(function() {
		var game = g;
		game.chains.draw.push(function(g,next) {
			game.objects.lists.background.each(function(o) {
				o.drawBackground(g);
			});
			game.objects.lists.shadow.each(function(o) {
				o.drawShadow(g);
			});
			game.objects.lists.foreground.each(function(o) {
				o.drawForeground(g);
			});
			game.objects.lists.drawItem.each(function(o) {
				o.drawItem(g);
			});
			next(g);
		});
	})();

	// (function() {
	// 	game.chains.draw.push(function(g,next) {
	// 		g.strokeStyle('black');
	// 		game.objects.lists.collidable.each(function(collidable) {
	// 			collidable.collisionlines.forEach(function(cl) {
	// 				g.strokeLine(cl.start.x,cl.start.y,cl.end.x,cl.end.y);
	// 			});
	// 		});
	// 		next(g);
	// 	});
	// })();

	//#gameobjects
	function slide(a,b) { return (a?0:1)-(b?0:1); }
	function drawBodyImage(g,image) {
		var me = this;
		var x = this.body.GetPosition().get_x();
		var y = this.body.GetPosition().get_y();
		var angle = this.body.GetAngle();

		var diameter = this.body.radius*2;
		g.rotate(x,y,angle-Math.PI*0.5,function() {
			g.drawCenteredImage(image,x,y,diameter/0.9,diameter/0.9);
		}.bind(this));
	}
	function Player(x,y) {
		this.body = createDynamicCircleBody(this,x,y,1.2);
		this.contacts = [];
		this.jumping = true;
		this.airTime = 0;
		this.groundTime = 0;
		this.item = null;
		this.queue = [];
	}
	(function(p) {
		p.player = true;
		p.updatable = true;
		p.foreground = true;
		p.image = images.player;
		p.update = function(dt) {
			var me = this;
			while(this.queue.length > 0) {
				this.queue.shift()();
			}
			var movement = slide(g.keys.left,g.keys.right);
			var desiredVelocity = -movement * Math.PI * 10;
			this.body.ApplyAngularImpulse((desiredVelocity - this.body.GetAngularVelocity())*dt*20);
			this.body.SetSleepingAllowed(0);
			this.body.SetAwake(1);
			// this.body.ApplyAngularImpulse(slide(g.keys.left,g.keys.right)*-10*dt);
			//console.log(this.body.GetAngularVelocity());
			if (this.contacts.length === 0 || this.jumping === 1) {
				this.jumping = 2;
				this.airTime += dt;
				this.groundTime = 0;
			} else {
				this.jumping = false;
				this.groundTime += dt;
				this.airTime = 0;
			}
			this.jumping = this.jumping && game.keys.up && this.airTime < 0.2;
			var horizontalAirControl = 100 * (this.airTime > 0?1:0);
			var verticalAirControl = 400 * (this.jumping?1:0);
			this.body.ApplyLinearImpulse(new b2Vec2(
				horizontalAirControl*dt*movement,
				(1.0-this.airTime/0.2)*verticalAirControl*dt
			),this.body.GetWorldCenter());
		};
		p.jump = function() {
			if (this.groundTime > 0) {
				playJump();
				this.jumping = 1;
				this.body.ApplyLinearImpulse(new b2Vec2(0,50),this.body.GetWorldCenter());
			}
		}
		var lastOuchTime = 0.0;
		p.onBeginContact = function(other,contact) {
			console.log('contact',other,contact);
			if (other) {
				if (other.usable) {
					transferOwnership(other,this);
				} else if (other.needsHeart && this.item) {
					transferOwnership(this.item,other);
					playYay();
					other.image = images.patient_happy;
				} else if (!other.needsHeart && other.item) {
					transferOwnership(other.item,this);
					playHeart();
				} else if (other.person && !other.needsHeart && !other.hasHeart) {
					if (game.time - lastOuchTime > 0.3) {
						playOuch();
						lastOuchTime = game.time;
					}
				}
			}
			this.contacts.push(contact);
		};
		p.onEndContact = function(other,contact) {
			this.contacts.splice(this.contacts.indexOf(contact),1);
		};
		p.drawForeground = function(g) {
			drawBodyImage.call(this,g,this.image);
		};

	})(Player.prototype);

	g.on('keydown',function(key) {
		if (player && key === 'up') {
			player.jump();
		}
	});


	function Person(image,properties,x,y,angle) {
		var me = this;
		this.body = createDynamicCircleBody(this,x,y,1.2);
		this.image = image;
		Object.keys(properties).forEach(function(key) {
			me[key] = properties[key];
		});
	}
	(function(p) {
		p.updatable = true;
		p.foreground = true;
		p.person = true;
		p.update = function(dt) {
			var me = this;
			// var desiredVelocity = -slide(g.keys.left,g.keys.right) * Math.PI * 10;
			// this.body.ApplyAngularImpulse((desiredVelocity - this.body.GetAngularVelocity())*dt);
		};
		// p.jump = function() {
		// 	if (this.standing > 0) {
		// 		this.body.ApplyLinearImpulse(new b2Vec2(0,10),this.body.GetWorldCenter());
		// 	}
		// }
		p.drawForeground = function(g) {
			drawBodyImage.call(this,g,this.image);
		};
		p.draw = p.drawForeground;

	})(Person.prototype);

	function Heart(x,y) {
		this.body = createDynamicCircleBody(this,x,y,0.5);
		this.owner = null;
	}
	(function(p) {
		p.usable = true;
		p.drawItem = function(g) {
			var me = this;
			var image = images.heart;
			var x,y,angle;
			var body = this.owner ? this.owner.body : this.body;
			var x = body.GetPosition().get_x();
			var y = body.GetPosition().get_y();
			var angle = body.GetAngle();

			var diameter = this.body.radius*2;
			var squeezex = Math.cos(game.time*10)*0.1+1;
			var squeezey = Math.cos(game.time*10+Math.PI)*0.1+1;
			g.scalerotate(x,y,squeezex*1.1*diameter/image.width,squeezey*1.1*diameter/image.width,angle-Math.PI*0.5,function() {
				if (this.owner) { y += 80; }
				g.drawCenteredImage(image,x,y);
			}.bind(this));
		};
	})(Heart.prototype);

	function transferOwnership(item,person) {
		console.log('Transfer ',item,'to',person);
		if (person.item === item) {
			console.log('Person already owns item');
			return;
		} else if (item.owner === person) {
			console.log('ERROR:',item.owner,person,'|||',person.item,item);
			console.log('wtf?');
			return;
		}
		if (person.item) {
			// Already has item.
			console.log('Person already has an item');
			return;
		}
		if (game.time - person.lastPickup < 1) {
			console.log(game.time - person.lastPickup);
			return;
		}
		if (item.owner) {
			item.owner.lastPickup = game.time;
			item.owner.item = null;
		}
		person.lastPickup = game.time;
		person.item = item;
		item.owner = person;
		console.log(person.item, item.owner);
		queueNextUpdate(function() {
			item.body.SetActive(0);
		});
	}

	function Wall(image,w,h,x,y,angle) {
		this.x = x;
		this.y = y;
		this.angle = angle;
		if (image) {
			this.drawable = true;
			this.image = image;
		}
		this.body = createStaticBox(x,y,w,h,angle);
	}
	Wall.prototype.draw = function(g) {
		var me = this;
		g.scalerotate(me.x,me.y,1/game.camera.PTM,1/game.camera.PTM,me.angle,function() {
			g.drawCenteredImage(me.image,me.x,me.y);
		});
	};

	function Ramp(image,x,y,angle) {
		this.x = x;
		this.y = y;
		this.angle = angle;
		if (image) {
			this.drawable = true;
			this.image = image;
		}
		console.log(arguments);
		this.body = createStaticPolygon([
			new b2Vec2(-1,1),
			new b2Vec2(-1,-1),
			new b2Vec2(1,1),
		],x,y,angle);
	}
	Ramp.prototype.draw = function(g) {
		var me = this;
		g.scalerotate(me.x,me.y,1/game.camera.PTM,1/game.camera.PTM,me.angle,function() {
			g.drawCenteredImage(me.image,me.x,me.y);
		});
	};

	function createLevelItem(Constructor,name,image/*,...*/) {
		var templateArguments = Array.prototype.slice.call(arguments);
		templateArguments.shift(); // Drop Constructor
		templateArguments.shift(); // Drop name
		function constructor(/*...*/) {
			var args = templateArguments.slice().concat(Array.prototype.slice.call(arguments));
			Constructor.apply(this,args); this.constArgs = args;
		}
		constructor.prototype.__proto__ = Constructor.prototype;
		constructor.prototype.image = image;
		constructor.prototype.constructorName = name;
		return constructor;
	}

	var Beam512 = createLevelItem(Wall,'Beam512',images.beam512,512/game.camera.PTM,64/game.camera.PTM);
	var Beam256 = createLevelItem(Wall,'Beam256',images.beam256,256/game.camera.PTM,64/game.camera.PTM);
	var Beam128 = createLevelItem(Wall,'Beam128',images.beam128,128/game.camera.PTM,64/game.camera.PTM);
	var Box128 = createLevelItem(Wall,'Box128',images.box128,128/game.camera.PTM,128/game.camera.PTM);
	var Box64 = createLevelItem(Wall,'Box64',images.box64,64/game.camera.PTM,64/game.camera.PTM);
	var Table = createLevelItem(Wall,'Table',images.table,128/game.camera.PTM,64/game.camera.PTM);
	var Chair = createLevelItem(Wall,'Chair',images.chair,64/game.camera.PTM,16/game.camera.PTM);
	Chair.prototype.chair = true;
	var Triangle64 = createLevelItem(Ramp,'Triangle64',images.triangle64);
	var Stairs64 = createLevelItem(Ramp,'Stairs64',images.stairs64);
	// var box = createWall('box',158,158,images.box);
	var Doctor = createLevelItem(Person,'Doctor',images.player,{});
	var BusinessPerson = createLevelItem(Person,'BusinessPerson',images.person_business,{});
	var LadyPerson = createLevelItem(Person,'LadyPerson',images.person_lady,{});
	var BoyPerson = createLevelItem(Person,'BoyPerson',images.person_boy,{});
	var GuyPerson = createLevelItem(Person,'GuyPerson',images.person_guy,{});
	var PatientInNeed = createLevelItem(Person,'PatientInNeed',images.patient,{needsHeart: true});
	var PatientWithHeart = createLevelItem(Person,'PatientWithHeart',images.patient,{hasHeart: true});

	//#states
	function gameplayState() {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		function enable() {
			g.chains.update.push(update);
			g.chains.draw.push(draw);
			g.on('keydown',keydown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
		}

		function update(dt,next) {
			// Post update
			game.world.Step(dt, 3, 2);

			// Check for win condition.
			var allSatisfied = true;
			game.objects.lists.needsHeart.each(function(patient) {
				allSatisfied = allSatisfied && patient.item;
			});
			if (allSatisfied) {
				player.image = images.player_happy;
				playYay();
				g.changeState(winState());
			}

			next(dt);
		}
		function draw(g,next) {
			// Draw HUD
			next(g);
		}
		function keydown(button) {
			if (button === 'r') {
				g.changeLevel(g.level.clone);
				g.changeState(gameplayState());
			}
		}
		return me;
	}

	function winState() {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		var time = 0;
		function enable() {
			console.log('winState');
			g.chains.update.push(update);
			g.chains.draw.unshift(draw);
			g.on('keydown',keydown);
		}
		function update(dt,next) {
			// Post update
			var timeTarget = 0.9;
			var t = Math.min(timeTarget,time);
			game.camera.zoom = Math.easeInOutCubic(t,1.0,-0.5,timeTarget);
			game.world.Step(Math.easeInOutCubic(t,1.0,-1.0,timeTarget)*dt, 3, 2);

			time += dt;

			next(dt);
		}
		function draw(g,next) {
			// Draw HUD
			next(g);
			var t = Math.min(2,Math.max(0,time-0.5));
			g.context.globalAlpha = Math.easeInOutCubic(t,0.0,1.0,2);
			g.drawCenteredImage(images.yousavedtheday,400,Math.easeInOutCubic(t,700,-200,2));
			g.context.globalAlpha = 1;
		}
		function keydown(button) {
			if (['space','enter'].indexOf(button) >= 0) {
				console.log(g.level.nextLevel);
				if (g.level.nextLevel) {
					g.changeLevel(g.level.nextLevel);
					g.changeState(gameplayState());
				} else {
					g.changeState(endState());
				}
			} else if (['r'].indexOf(button) >= 0) {
				g.changeLevel(g.level.clone);
				g.changeState(gameplayState());
			}
		}
		function disable() {
			game.camera.zoom = 1;
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
			g.removeListener('keydown',keydown);
		}
		return me;
	}

	function endState() {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		var time = 0;
		function enable() {
			g.chains.draw.unshift(draw);
		}
		function draw(g,next) {
			// Draw HUD
			next(g);
			g.drawCenteredImage(images.thanksforplaying,400,300);
		}
		function disable() {
			g.chains.draw.remove(draw);
		}
		return me;
	}

	var player;
	g.on('levelchanged',function() {
		console.log('levelchanged');
		g.objects.handlePending();
		
		g.objects.lists.player.each(function(p) {
			player = p;
		});

		g.objects.lists.hasHeart.each(function(patient) {
			var heart = new Heart(0,0);
			game.objects.add(heart);
			transferOwnership(heart,patient);
		});

		var personConstructors = [BusinessPerson,LadyPerson,BoyPerson,GuyPerson];
		g.objects.lists.chair.each(function(chair) {
			var PersonConstructor = personConstructors[(Math.random() * personConstructors.length) | 0];
			var person = new PersonConstructor(chair.x,chair.y+2,0);
			console.log('image:',person.image);
			game.objects.add(person);
		});

		g.objects.handlePending();
	});
	g.chains.draw.insertBefore(function(g,next) {
		next(g);
	},g.chains.draw.objects);

	g.on('levelunloaded',function() {
		g.objects.handlePending();
		g.objects.clear();
		g.objects.handlePending();
		console.log('levelunloaded');
		g.resetWorld();
	});

	function flatten(arr) {
		var r = [];
		for(var i=0;i<arr.length;i++) {
			if (arr[i].length !== undefined) {
				r = r.concat(flatten(arr[i]));
			} else {
				r.push(arr[i]);
			}
		}
		return r;
	}

	//#levels
	function level_sym1() {
		return {
			name: 'Level1',
			objects: 
			[
new Triangle64(-4,1,angle_left),
new Beam512(-4,-8,angle_up),
new Beam512(5,1,angle_right),
new Beam128(14,0,angle_up),
new Beam512(23,1,angle_right),


new Beam512(5,-8,angle_right),
new Box64(32,1,angle_right),
new Box64(14,-8,angle_right),
new Beam512(41,1,angle_right),
new Beam512(41,-8,angle_right),
new Box64(32,-8,angle_right),
new Box64(50,-8,angle_right),
new Beam512(23,-8,angle_right),
new Beam512(52,-8,angle_up),
new Triangle64(52,1,angle_down),
new Beam128(32,0,angle_down),
new Box64(50,1,angle_up),

new Table(1,-6,angle_left),
new PatientWithHeart(1,-3,0),

new Table(44,-6,angle_left),
new PatientInNeed(44,-3,0),
new Player(5,-7)
			],
			clone: arguments.callee,
			nextLevel: level_sym2
		};
	}

	function level_sym2() {
		return {
			objects: [
new Beam256(0,-2,angle_left),
new Stairs64(-5,-2,angle_left),
new Stairs64(-7,-4,angle_left),
new Stairs64(-9,-6,angle_left),
new Stairs64(-11,-8,angle_left),
new Stairs64(5,-2,angle_down),
new Stairs64(7,-4,angle_down),
new Stairs64(9,-6,angle_down),
new Stairs64(11,-8,angle_down),
new Beam512(0,-6,angle_right),
new Beam256(6,-8,angle_right),
new Beam256(-6,-8,angle_right),
new Beam128(0,-8,angle_right),
new Beam128(-4,-4,angle_right),
new Beam128(4,-4,angle_right),
new Beam128(0,-4,angle_right),

new Beam512(20,-10,angle_left),
new Triangle64(11,-10,angle_up),
new Box64(29,-10,angle_up),
new Beam128(29,-3,angle_up),
new Beam512(38,-10,angle_left),
new Beam512(47,-3,angle_down),
new Beam512(38,-2,angle_right),
new Beam512(20,-2,angle_right),
new Beam512(38,6,angle_right),
new Beam128(29,5,angle_up),
new Beam256(24,6,angle_right),
new Beam128(18,6,angle_right),
new Beam256(12,6,angle_right),
new Beam128(6,6,angle_right),
new Beam256(0,6,angle_right),
new Beam128(-6,6,angle_right),
new Beam256(-12,6,angle_right),
new Table(38,0,angle_left),
new Table(38,-8,angle_left),

new Beam512(-20,-10,angle_left),
new Triangle64(-11,-10,angle_right),
new Box64(-29,-10,angle_up),
new Beam128(-29,-3,angle_up),
new Beam512(-38,-10,angle_left),
new Beam512(-47,-3,angle_down),
new Beam512(-38,-2,angle_right),
new Beam512(-20,-2,angle_right),
new Beam512(-38,6,angle_right),
new Beam128(-29,5,angle_up),
new Beam256(-24,6,angle_right),
new Beam128(-18,6,angle_right),
new Beam256(-12,6,angle_right),
new Beam128(-6,6,angle_right),
new Beam256(-0,6,angle_right),
new Triangle64(-47,6,angle_left),
new Table(-38,0,angle_left),
new Table(-38,-8,angle_left),

new PatientInNeed(38,2,angle_left),
new PatientWithHeart(38,-6,angle_left),
new PatientInNeed(-38,2,angle_left),
new PatientWithHeart(-38,-6,angle_left),

new Player(0,0),


			],
			clone: arguments.callee,
			nextLevel: level_a
		};
	}

	function level_a() {
		return {
			name: 'Level2',
			objects: 
			[
new Beam512(0,-10,angle_right),
new Player(5,-7),
new Box64(9,-10,angle_left),
new Beam128(9,-3,angle_down),
new Beam256(-9,-7,angle_down),
new Beam512(0,-2,angle_right),
new Beam512(18,-10,angle_left),
new Stairs64(15,-8,angle_left),
new Stairs64(17,-6,angle_left),
new Stairs64(19,-4,angle_left),
new Beam128(12,-2,angle_left),
new Stairs64(21,-2,angle_left),
new Beam256(22,-8,angle_left),
new Box64(17,-8,angle_left),
new Beam128(20,-6,angle_left),
new Beam128(22,-4,angle_left),
new Beam128(24,-2,angle_left),
new Beam128(24,-6,angle_left),
new Box64(25,-4,angle_left),
new Stairs64(9,0,angle_down),
new Stairs64(7,2,angle_down),
new Stairs64(5,4,angle_down),
new Stairs64(3,6,angle_down),
new Beam256(-2,6,angle_right),
new Stairs64(-7,6,angle_left),
new Stairs64(-9,4,angle_left),
new Stairs64(-11,2,angle_left),
new Stairs64(-13,0,angle_left),
new Beam512(-2,2,angle_left),
new Beam512(0,0,angle_left),
new Beam128(-10,0,angle_left),
new Beam128(-6,4,angle_left),
new Beam256(0,4,angle_left),
new Beam512(18,6,angle_left),
new Beam256(-18,6,angle_left),
new Beam512(-16,-2,angle_left),
new Beam512(34,-2,angle_left),
new Beam256(43,1,angle_down),
new Beam512(34,6,angle_right),
new Box64(-23,6,angle_right),
new Beam128(-25,5,angle_up),
new Box64(-25,-2,angle_up),
new Beam512(-34,-2,angle_left),
new Beam256(-43,1,angle_down),
new Beam512(-35,6,angle_right),
new Beam512(-34,6,angle_right),
new Beam256(-43,9,angle_up),
new Stairs64(-41,12,angle_down),
new Stairs64(-39,10,angle_down),
new Stairs64(-37,8,angle_down),
new Beam128(-40,8,angle_right),
new Box64(-41,10,angle_right),
new Stairs64(-43,14,angle_down),
new Beam256(-48,14,angle_right),
new Beam256(-32,14,angle_right),
new Beam128(-25,13,angle_up),
new Box64(-27,14,angle_up),
new Beam512(-16,14,angle_left),
new Beam256(43,9,angle_down),
new Beam128(-6,14,angle_right),
new Box64(-3,14,angle_right),
new Beam128(0,14,angle_right),
new Beam512(10,14,angle_right),
new Beam256(38,14,angle_right),
new Stairs64(33,14,angle_left),
new Stairs64(31,12,angle_left),
new Stairs64(29,10,angle_left),
new Stairs64(27,8,angle_left),
new Beam128(31,9,angle_down),
new Beam128(33,11,angle_down),
new Box64(33,8,angle_down),
new Box64(29,8,angle_down),
new Beam256(22,14,angle_right),
new Beam256(43,17,angle_up),
new Beam256(-53,17,angle_up),
new Beam512(-44,22,angle_left),
new Triangle64(-45,12,angle_up),
new Triangle64(-53,22,angle_left),
new Beam256(-32,22,angle_left),
new Beam128(-25,21,angle_down),
new Box64(-27,22,angle_down),
new Beam512(-16,22,angle_right),
new Box128(-3,17,angle_up),
new Stairs64(-6,18,angle_left),
new Stairs64(-8,16,angle_left),
new Stairs64(0,18,angle_down),
new Stairs64(2,16,angle_down),
new Box64(0,16,angle_down),
new Box64(-6,16,angle_down),
new Beam512(9,22,angle_right),
new Beam512(25,22,angle_right),
new Beam256(37,22,angle_right),
new Beam256(45,22,angle_right),
new Beam256(50,25,angle_up),
new Beam512(41,30,angle_left),
new Triangle64(45,20,angle_right),
new Box64(32,30,angle_right),
new Beam128(29,30,angle_right),
new Beam256(23,30,angle_right),
new Beam128(18,29,angle_up),
new Beam512(-3,30,angle_left),
new Beam256(13,30,angle_left),
new Beam128(7,30,angle_left),
new Beam256(-51,27,angle_down),
new Beam256(-15,30,angle_right),
new Beam128(-25,29,angle_up),
new Beam256(-23,30,angle_left),
new Beam512(-35,30,angle_left),
new Beam256(-47,30,angle_left),
new Beam128(35,9,angle_down),
new Beam128(37,11,angle_down),
new Beam128(39,9,angle_down),
new Beam128(41,11,angle_down),
new Box64(39,12,angle_down),
new Box64(35,12,angle_down),
new Box64(37,8,angle_right),
new Box64(41,8,angle_up),

new Table(42,24,angle_left),
new PatientWithHeart(42,26,angle_left),
new Table(31,24,angle_left),
new PatientWithHeart(31,26,angle_left),
new Table(-44,24,angle_left),
new PatientInNeed(-44,26,angle_left),
new Table(-36,0,angle_left),
new PatientInNeed(-36,2,angle_left),
			],
			clone: arguments.callee,
			nextLevel: level_b
		};
	}

	function level_b() {
		return {
			name: 'LevelB',
			objects: [
new Beam512(0,-10,angle_right),
new Player(5,-7),
new Beam512(18,-10,angle_left),
new Box64(9,-10,angle_left),
new Beam256(-10,-8,angle_left),
new Stairs64(-5,-8,angle_down),
new Beam256(-16,-6,angle_right),
new Stairs64(-11,-6,angle_down),
new Stairs64(-19,-4,angle_down),
new Beam256(-24,-4,angle_right),
new Beam256(-34,-4,angle_right),
new Box64(-29,-4,angle_right),
new Beam128(-29,3,angle_up),
new Beam256(-39,-1,angle_down),
new Beam256(-34,4,angle_right),
new Triangle64(-39,4,angle_left),
new Table(-35,-2,angle_left),
new Stairs64(-15,0,angle_left),
new Stairs64(-13,2,angle_left),
new Stairs64(-11,4,angle_left),
new Beam512(-2,4,angle_left),
new Triangle64(-13,0,angle_right),
new Triangle64(-11,2,angle_right),
new Beam256(-37,9,angle_up),
new Beam512(-28,12,angle_left),
new Table(-33,6,angle_left),
new Beam512(-10,12,angle_left),
new Beam256(2,12,angle_left),
new Box64(9,12,angle_left),
new Box64(7,12,angle_left),
new Box64(11,12,angle_left),
new Beam256(9,-5,angle_down),
new Beam256(-24,4,angle_right),
new Box64(7,4,angle_right),
new Box64(9,4,angle_right),
new Box64(11,4,angle_right),
new Beam512(20,4,angle_left),
new Beam128(8,1,angle_down),
new Beam128(10,1,angle_down),
new Beam256(16,12,angle_left),
new Beam256(29,7,angle_down),
new Stairs64(29,12,angle_left),
new Stairs64(27,10,angle_left),
new Stairs64(25,8,angle_left),
new Stairs64(23,6,angle_left),
new Beam128(26,6,angle_left),
new Box64(27,8,angle_left),
new Beam256(34,12,angle_left),
new Triangle64(31,10,angle_right),
new Box64(39,12,angle_left),
new Beam128(39,19,angle_down),
new Beam512(48,12,angle_right),
new Table(50,14,angle_left),
new Beam256(57,15,angle_down),
new Beam512(48,20,angle_right),
new Triangle64(57,20,angle_down),
new Beam512(30,22,angle_right),
new Triangle64(39,22,angle_down),
new Beam512(12,22,angle_left),
new Box64(21,22,angle_left),
new Box128(-4,15,angle_left),
new Stairs64(-1,14,angle_down),
new Stairs64(-1,16,angle_down),
new Stairs64(1,14,angle_down),
new Box64(-1,14,angle_down),
new Box64(-7,14,angle_down),
new Stairs64(-7,16,angle_left),
new Stairs64(-9,14,angle_left),
new Beam512(-4,24,angle_left),
new Triangle64(5,24,angle_down),
new Beam512(-20,22,angle_right),
new Triangle64(-12,24,angle_left),
new Triangle64(-13,24,angle_left),
new Beam256(-32,22,angle_left),
new Beam256(-37,17,angle_down),
new Triangle64(-37,22,angle_left),
new Box64(-19,12,angle_left),
new Table(-33,14,angle_left),

new PatientWithHeart(-33,16,angle_left),
new PatientWithHeart(50,16,angle_left),
new PatientInNeed(-33,8,angle_left),
new PatientInNeed(-35,0,angle_left)
			],
			clone: arguments.callee,
			nextLevel: level_sym1_v
		}
	}

	function level_sym1_v() {
		return {
			name: 'Level1',
			objects: 
			[
new Triangle64(-4,1,angle_left),
new Beam512(-4,-8,angle_up),
new Beam512(5,1,angle_right),
new Beam128(14,0,angle_up),
new Beam512(23,1,angle_right),


new Beam512(5,-8,angle_right),
new Box64(32,1,angle_right),
new Box64(14,-8,angle_right),
new Beam512(41,1,angle_right),
new Beam512(41,-8,angle_right),
new Box64(32,-8,angle_right),
new Box64(50,-8,angle_right),
new Beam512(23,-8,angle_right),
new Beam512(52,-8,angle_up),
new Triangle64(52,1,angle_down),
new Beam128(32,0,angle_down),
new Box64(50,1,angle_up),

new Table(1,-6,angle_left),
new PatientWithHeart(1,-3,0),

new Table(44,-6,angle_left),
new PatientInNeed(44,-3,0),
new Chair(20,-6.5,angle_left),
new Chair(25,-6.5,angle_left),
new Player(5,-7)
			],
			clone: arguments.callee,
			nextLevel: level_sym2_v
		};
	}

	function level_sym2_v() {
		return {
			objects: [
new Beam256(0,-2,angle_left),
new Stairs64(-5,-2,angle_left),
new Stairs64(-7,-4,angle_left),
new Stairs64(-9,-6,angle_left),
new Stairs64(-11,-8,angle_left),
new Stairs64(5,-2,angle_down),
new Stairs64(7,-4,angle_down),
new Stairs64(9,-6,angle_down),
new Stairs64(11,-8,angle_down),
new Beam512(0,-6,angle_right),
new Beam256(6,-8,angle_right),
new Beam256(-6,-8,angle_right),
new Beam128(0,-8,angle_right),
new Beam128(-4,-4,angle_right),
new Beam128(4,-4,angle_right),
new Beam128(0,-4,angle_right),

new Beam512(20,-10,angle_left),
new Triangle64(11,-10,angle_up),
new Box64(29,-10,angle_up),
new Beam128(29,-3,angle_up),
new Beam512(38,-10,angle_left),
new Beam512(47,-3,angle_down),
new Beam512(38,-2,angle_right),
new Beam512(20,-2,angle_right),
new Beam512(38,6,angle_right),
new Beam128(29,5,angle_up),
new Beam256(24,6,angle_right),
new Beam128(18,6,angle_right),
new Beam256(12,6,angle_right),
new Beam128(6,6,angle_right),
new Beam256(0,6,angle_right),
new Beam128(-6,6,angle_right),
new Beam256(-12,6,angle_right),
new Table(38,0,angle_left),
new Table(38,-8,angle_left),

new Beam512(-20,-10,angle_left),
new Triangle64(-11,-10,angle_right),
new Box64(-29,-10,angle_up),
new Beam128(-29,-3,angle_up),
new Beam512(-38,-10,angle_left),
new Beam512(-47,-3,angle_down),
new Beam512(-38,-2,angle_right),
new Beam512(-20,-2,angle_right),
new Beam512(-38,6,angle_right),
new Beam128(-29,5,angle_up),
new Beam256(-24,6,angle_right),
new Beam128(-18,6,angle_right),
new Beam256(-12,6,angle_right),
new Beam128(-6,6,angle_right),
new Beam256(-0,6,angle_right),
new Triangle64(-47,6,angle_left),
new Table(-38,0,angle_left),
new Table(-38,-8,angle_left),

new PatientInNeed(38,2,angle_left),
new PatientWithHeart(38,-6,angle_left),
new PatientInNeed(-38,2,angle_left),
new PatientWithHeart(-38,-6,angle_left),

new Player(0,0),


			],
			clone: arguments.callee,
			nextLevel: level_a_v
		};
	}

	function level_a_v() {
		return {
			name: 'Level2',
			objects: 
			[
new Beam512(0,-10,angle_right),
new Player(5,-7),
new Box64(9,-10,angle_left),
new Beam128(9,-3,angle_down),
new Beam256(-9,-7,angle_down),
new Beam512(0,-2,angle_right),
new Beam512(18,-10,angle_left),
new Stairs64(15,-8,angle_left),
new Stairs64(17,-6,angle_left),
new Stairs64(19,-4,angle_left),
new Beam128(12,-2,angle_left),
new Stairs64(21,-2,angle_left),
new Beam256(22,-8,angle_left),
new Box64(17,-8,angle_left),
new Beam128(20,-6,angle_left),
new Beam128(22,-4,angle_left),
new Beam128(24,-2,angle_left),
new Beam128(24,-6,angle_left),
new Box64(25,-4,angle_left),
new Stairs64(9,0,angle_down),
new Stairs64(7,2,angle_down),
new Stairs64(5,4,angle_down),
new Stairs64(3,6,angle_down),
new Beam256(-2,6,angle_right),
new Stairs64(-7,6,angle_left),
new Stairs64(-9,4,angle_left),
new Stairs64(-11,2,angle_left),
new Stairs64(-13,0,angle_left),
new Beam512(-2,2,angle_left),
new Beam512(0,0,angle_left),
new Beam128(-10,0,angle_left),
new Beam128(-6,4,angle_left),
new Beam256(0,4,angle_left),
new Beam512(18,6,angle_left),
new Beam256(-18,6,angle_left),
new Beam512(-16,-2,angle_left),
new Beam512(34,-2,angle_left),
new Beam256(43,1,angle_down),
new Beam512(34,6,angle_right),
new Box64(-23,6,angle_right),
new Beam128(-25,5,angle_up),
new Box64(-25,-2,angle_up),
new Beam512(-34,-2,angle_left),
new Beam256(-43,1,angle_down),
new Beam512(-35,6,angle_right),
new Beam512(-34,6,angle_right),
new Beam256(-43,9,angle_up),
new Stairs64(-41,12,angle_down),
new Stairs64(-39,10,angle_down),
new Stairs64(-37,8,angle_down),
new Beam128(-40,8,angle_right),
new Box64(-41,10,angle_right),
new Stairs64(-43,14,angle_down),
new Beam256(-48,14,angle_right),
new Beam256(-32,14,angle_right),
new Beam128(-25,13,angle_up),
new Box64(-27,14,angle_up),
new Beam512(-16,14,angle_left),
new Beam256(43,9,angle_down),
new Beam128(-6,14,angle_right),
new Box64(-3,14,angle_right),
new Beam128(0,14,angle_right),
new Beam512(10,14,angle_right),
new Beam256(38,14,angle_right),
new Stairs64(33,14,angle_left),
new Stairs64(31,12,angle_left),
new Stairs64(29,10,angle_left),
new Stairs64(27,8,angle_left),
new Beam128(31,9,angle_down),
new Beam128(33,11,angle_down),
new Box64(33,8,angle_down),
new Box64(29,8,angle_down),
new Beam256(22,14,angle_right),
new Beam256(43,17,angle_up),
new Beam256(-53,17,angle_up),
new Beam512(-44,22,angle_left),
new Triangle64(-45,12,angle_up),
new Triangle64(-53,22,angle_left),
new Beam256(-32,22,angle_left),
new Beam128(-25,21,angle_down),
new Box64(-27,22,angle_down),
new Beam512(-16,22,angle_right),
new Box128(-3,17,angle_up),
new Stairs64(-6,18,angle_left),
new Stairs64(-8,16,angle_left),
new Stairs64(0,18,angle_down),
new Stairs64(2,16,angle_down),
new Box64(0,16,angle_down),
new Box64(-6,16,angle_down),
new Beam512(9,22,angle_right),
new Beam512(25,22,angle_right),
new Beam256(37,22,angle_right),
new Beam256(45,22,angle_right),
new Beam256(50,25,angle_up),
new Beam512(41,30,angle_left),
new Triangle64(45,20,angle_right),
new Box64(32,30,angle_right),
new Beam128(29,30,angle_right),
new Beam256(23,30,angle_right),
new Beam128(18,29,angle_up),
new Beam512(-3,30,angle_left),
new Beam256(13,30,angle_left),
new Beam128(7,30,angle_left),
new Beam256(-51,27,angle_down),
new Beam256(-15,30,angle_right),
new Beam128(-25,29,angle_up),
new Beam256(-23,30,angle_left),
new Beam512(-35,30,angle_left),
new Beam256(-47,30,angle_left),
new Beam128(35,9,angle_down),
new Beam128(37,11,angle_down),
new Beam128(39,9,angle_down),
new Beam128(41,11,angle_down),
new Box64(39,12,angle_down),
new Box64(35,12,angle_down),
new Box64(37,8,angle_right),
new Box64(41,8,angle_up),

new Table(42,24,angle_left),
new PatientWithHeart(42,26,angle_left),
new Table(31,24,angle_left),
new PatientWithHeart(31,26,angle_left),
new Table(-44,24,angle_left),
new PatientInNeed(-44,26,angle_left),
new Table(-36,0,angle_left),
new PatientInNeed(-36,2,angle_left),

new Chair(36,-0.5,angle_left),
new Chair(32,-0.5,angle_left),
new Chair(8,15.5,angle_left),
new Chair(12,15.5,angle_left),
new Chair(9,23.5,angle_left),
new Chair(-18,23.5,angle_left),
new Chair(-14,23.5,angle_left),
new Chair(-48,15.5,angle_left)
			],
			clone: arguments.callee,
			nextLevel: level_b_v
		};
	}

	function level_b_v() {
		return {
			name: 'LevelB',
			objects: [
new Beam512(0,-10,angle_right),
new Player(5,-7),
new Beam512(18,-10,angle_left),
new Box64(9,-10,angle_left),
new Beam256(-10,-8,angle_left),
new Stairs64(-5,-8,angle_down),
new Beam256(-16,-6,angle_right),
new Stairs64(-11,-6,angle_down),
new Stairs64(-19,-4,angle_down),
new Beam256(-24,-4,angle_right),
new Beam256(-34,-4,angle_right),
new Box64(-29,-4,angle_right),
new Beam128(-29,3,angle_up),
new Beam256(-39,-1,angle_down),
new Beam256(-34,4,angle_right),
new Triangle64(-39,4,angle_left),
new Table(-35,-2,angle_left),
new Stairs64(-15,0,angle_left),
new Stairs64(-13,2,angle_left),
new Stairs64(-11,4,angle_left),
new Beam512(-2,4,angle_left),
new Triangle64(-13,0,angle_right),
new Triangle64(-11,2,angle_right),
new Beam256(-37,9,angle_up),
new Beam512(-28,12,angle_left),
new Table(-33,6,angle_left),
new Beam512(-10,12,angle_left),
new Beam256(2,12,angle_left),
new Box64(9,12,angle_left),
new Box64(7,12,angle_left),
new Box64(11,12,angle_left),
new Beam256(9,-5,angle_down),
new Beam256(-24,4,angle_right),
new Box64(7,4,angle_right),
new Box64(9,4,angle_right),
new Box64(11,4,angle_right),
new Beam512(20,4,angle_left),
new Beam128(8,1,angle_down),
new Beam128(10,1,angle_down),
new Beam256(16,12,angle_left),
new Beam256(29,7,angle_down),
new Stairs64(29,12,angle_left),
new Stairs64(27,10,angle_left),
new Stairs64(25,8,angle_left),
new Stairs64(23,6,angle_left),
new Beam128(26,6,angle_left),
new Box64(27,8,angle_left),
new Beam256(34,12,angle_left),
new Triangle64(31,10,angle_right),
new Box64(39,12,angle_left),
new Beam128(39,19,angle_down),
new Beam512(48,12,angle_right),
new Table(50,14,angle_left),
new Beam256(57,15,angle_down),
new Beam512(48,20,angle_right),
new Triangle64(57,20,angle_down),
new Beam512(30,22,angle_right),
new Triangle64(39,22,angle_down),
new Beam512(12,22,angle_left),
new Box64(21,22,angle_left),
new Box128(-4,15,angle_left),
new Stairs64(-1,14,angle_down),
new Stairs64(-1,16,angle_down),
new Stairs64(1,14,angle_down),
new Box64(-1,14,angle_down),
new Box64(-7,14,angle_down),
new Stairs64(-7,16,angle_left),
new Stairs64(-9,14,angle_left),
new Beam512(-4,24,angle_left),
new Triangle64(5,24,angle_down),
new Beam512(-20,22,angle_right),
new Triangle64(-12,24,angle_left),
new Triangle64(-13,24,angle_left),
new Beam256(-32,22,angle_left),
new Beam256(-37,17,angle_down),
new Triangle64(-37,22,angle_left),
new Box64(-19,12,angle_left),
new Table(-33,14,angle_left),

new Chair(5,5.5,angle_left),
new Chair(8,5.5,angle_left),
new Chair(11,5.5,angle_left),
new Chair(14,13.5,angle_left),
new Chair(11,13.5,angle_left),

new PatientWithHeart(-33,16,angle_left),
new PatientWithHeart(50,16,angle_left),
new PatientInNeed(-33,8,angle_left),
new PatientInNeed(-35,0,angle_left)
			],
			clone: arguments.callee,
			nextLevel: null
		}
	}


	function level_new() {
		return {
			name: 'LevelNew',
			objects: 
			[
			new Beam512(0,-10,angle_right),
			new Player(5,-7),
			new PatientInNeed(100,2,angle_left)
			]
		};
	}

	g.changeLevel(level_sym1);
	g.changeState(gameplayState());

	g.start();
	}
});

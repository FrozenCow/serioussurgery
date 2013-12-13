define(['platform','game','vector','staticcollidable','linesegment','editor','required','state','level','mouse','collision','keyboard','quake','resources','quadtree'],function(platform,Game,Vector,StaticCollidable,LineSegment,editor,required,state,level,mouse,collision,keyboard,quake,resources,QuadTree) {
	var t = new Vector(0,0);
	var t2 = new Vector(0,0);
	var rs = {
		'images': ['mafkees','background','beam','box'],
		'audio': []
	};
	var black = '#111';
	var g,game;
	platform.once('load',function() {
		var canvas = document.getElementById('main');
		game = g = new Game(startGame, canvas, [required(['chrome']),mouse,keyboard,resources(rs),state,level,collision,quake]);
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

	g.objects.lists.shadow = g.objects.createIndexList('shadow');
	g.objects.lists.background = g.objects.createIndexList('background');
	g.objects.lists.foreground = g.objects.createIndexList('foreground');

	// Camera
	(function() {
		game.camera = new Vector(0,0);

		var pattern;
		function drawCamera(g,next) {
			if (!pattern) {
				pattern = g.context.createPattern(images.background,'repeat');
			}
			g.save();
			g.context.translate(game.camera.x,game.camera.y);
			g.fillStyle(pattern);
			g.fillRectangle(-game.camera.x,-game.camera.y,800,600);
			next(g);
			g.restore();
		}
		g.chains.draw.camera = drawCamera;
		g.chains.draw.insertBefore(drawCamera,g.chains.draw.objects);

		function updateCamera(dt,next) {
			// Center on player
			t.set(-player.position.x+400, -player.position.y+300);
			var n = t;
			var o = game.camera;
			game.camera.set(n.x,o.y*0.05+n.y*0.95);
			/*game.camera.left = player.position.x-400;
			game.camera.right = player.position.x+400;
			game.camera.top = player.position.y+300;
			game.camera.bottom = player.position.y-300;*/
			next(dt);
		}
		g.chains.update.camera = updateCamera;
		g.chains.update.push(updateCamera);
	})();

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

	// Collision
	(function() {
		var t = new Vector(0,0)
		var t2 = new Vector(0,0);

		g.objects.lists.collidable = g.objects.createIndexList('collidable');
		g.objects.lists.collide = g.objects.createIndexList('collide');

		g.chains.update.insertAfter(function(dt,next) {
			handleCollision();
			next(dt);
		},g.chains.update.objects);

		function handleCollision() {
			g.objects.lists.collide.each(function(o) {
				if (!o.velocity){return;}
				o.surface = null;
				for(var tries=0;tries<5;tries++) {
					var collisions = [];
					function handleCollisionLineSegments(lineSegments) {
						for(var i=0;i<lineSegments.length;i++) {
							var lineSegment = lineSegments[i];
							t.setV(lineSegment.normal);
							t.normalRight();
							var l = lineSegment.start.distanceToV(lineSegment.end);
							t2.setV(o.position);
							t2.substractV(lineSegment.start);
							var offY = lineSegment.normal.dotV(t2)-o.collisionRadius;
							var offX = t.dotV(t2);
							if (offY < -o.collisionRadius*2) {
								continue;
							} else if (offY < 0) {
								if (offX > 0 && offX < l) {
									offY*=-1;
									collisions.push({
										normalx:lineSegment.normal.x,
										normaly:lineSegment.normal.y,
										offset:offY
									});
								} else if (offX < 0 && offX > -o.collisionRadius) {
									var d = o.position.distanceToV(lineSegment.start);
									if (d < o.collisionRadius) {
										t.setV(o.position);
										t.substractV(lineSegment.start);
										t.normalize();
										collisions.push({
											normalx:t.x,
											normaly:t.y,
											offset:o.collisionRadius-d
										});
									}
								} else if (offX > l && offX < l+o.collisionRadius) {
									var d = o.position.distanceToV(lineSegment.end);
									if (d < o.collisionRadius) {
										t.setV(o.position);
										t.substractV(lineSegment.end);
										t.normalize();
										collisions.push({
											normalx:t.x,
											normaly:t.y,
											offset:o.collisionRadius-d
										});
									}
								}
							} else {
								continue;
							}
						}
					}
					function handleCollisionRadius(x,y,radius) {
						if (o.position.distanceTo(x,y) < radius+o.collisionRadius) {
							t.setV(o.position);
							t.substract(x,y);
							t.normalize();
							collisions.push({
								normalx: t.x,
								normaly: t.y,
								offset: radius+o.collisionRadius-o.position.distanceTo(x,y)
							});
						}
					}
					g.objects.lists.collidable.each(function(collidable) {
						if (collidable.collisionlines) {
							handleCollisionLineSegments(collidable.collisionlines);
						} else {
							handleCollisionRadius(collidable.position.x,collidable.position.y,collidable.radius);
						}
					});
					if (collisions.length > 0) {
						collisions.sort(function(a,b) {
							return b.offset-a.offset;
						});
						var c = collisions[0];
						o.position.add(c.normalx*(c.offset+1),c.normaly*(c.offset+1));
						var vc = o.velocity.dot(c.normalx, c.normaly);
						var bounciness = o.bounciness || 0;
						o.velocity.substract(c.normalx*vc*(1+bounciness), c.normaly*vc*(1+bounciness));
						o.surface = c;
						if (o.collided) { o.collided(c); }
					} else {
						break;
					}
				}
			});
		}
		// Debug collision
		g.chains.draw.push(function(g,next) {
			next(g);
			g.strokeStyle('red');
			game.objects.lists.collidable.each(function(collidable) {
				if (collidable.collisionlines) {
					collidable.collisionlines.forEach(function(collisionline) {
						g.strokeLine(collisionline.start.x,collisionline.start.y,collisionline.end.x,collisionline.end.y);
					});
				}
			});

			game.objects.lists.collide.each(function(collide) {
				g.strokeCircle(collide.position.x,collide.position.y,collide.collisionRadius);
			});
		});
	}());


	// From: http://www.ahristov.com/tutorial/geometry-games/intersection-lines.html
	function intersection(x1,y1,x2,y2, x3,y3,x4,y4, result) {
		var d = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
		if (d == 0) return false;

		var xi = ((x3-x4)*(x1*y2-y1*x2)-(x1-x2)*(x3*y4-y3*x4))/d;
		var yi = ((y3-y4)*(x1*y2-y1*x2)-(y1-y2)*(x3*y4-y3*x4))/d;

		result.set(xi,yi);
		return true;
	}

 	// Tracing
	(function() {
		var t = new Vector(0,0);

		function IsOnSegment(xi, yi, xj, yj, xk, yk) {
			return	(xi <= xk || xj <= xk) && (xk <= xi || xk <= xj) &&
					(yi <= yk || yj <= yk) && (yk <= yi || yk <= yj);
		}

		function ComputeDirection(xi, yi, xj, yj, xk, yk) {
			var a = (xk - xi) * (yj - yi);
			var b = (xj - xi) * (yk - yi);
			return a < b ? -1 : a > b ? 1 : 0;
		}

		// From: http://ptspts.blogspot.nl/2010/06/how-to-determine-if-two-line-segments.html
		function DoLineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
			var d1 = ComputeDirection(x3, y3, x4, y4, x1, y1);
			var d2 = ComputeDirection(x3, y3, x4, y4, x2, y2);
			var d3 = ComputeDirection(x1, y1, x2, y2, x3, y3);
			var d4 = ComputeDirection(x1, y1, x2, y2, x4, y4);
			return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
					((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
					(d1 == 0 && IsOnSegment(x3, y3, x4, y4, x1, y1)) ||
					(d2 == 0 && IsOnSegment(x3, y3, x4, y4, x2, y2)) ||
					(d3 == 0 && IsOnSegment(x1, y1, x2, y2, x3, y3)) ||
					(d4 == 0 && IsOnSegment(x1, y1, x2, y2, x4, y4));
		}

		// From: http://www.ahristov.com/tutorial/geometry-games/intersection-lines.html
		function intersection(x1,y1,x2,y2, x3,y3,x4,y4, result) {
			var d = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
			if (d == 0) return false;

			var xi = ((x3-x4)*(x1*y2-y1*x2)-(x1-x2)*(x3*y4-y3*x4))/d;
			var yi = ((y3-y4)*(x1*y2-y1*x2)-(y1-y2)*(x3*y4-y3*x4))/d;

			result.set(xi,yi);
			return true;
		}

		g.cantrace = function(fromx,fromy,tox,toy) {
			var result = true;
			game.objects.lists.collidable.each(function(collidable,BREAK) {
				for(var i=0;i<collidable.collisionlines.length;i++) {
					var cl = collidable.collisionlines[i];
					var fd = cl.normal.dot(fromx-tox,fromy-toy);

					// Is collision in right direction (toward fromxy)
					if (fd < 0) { continue; }

					// Are line-segments intersecting?
					if (!DoLineSegmentsIntersect(
						fromx,fromy,tox,toy,
						cl.start.x,cl.start.y,cl.end.x,cl.end.y
						)) { continue; }

					result = false;
					return BREAK;
				}
			});
			return result;
		};

		g.trace = function(fromx,fromy,tox,toy) {
			var c = null;
			game.objects.lists.collidable.each(function(collidable) {
				for(var i=0;i<collidable.collisionlines.length;i++) {
					var fd = cl.normal.dot(fromx-tox,fromy-toy);

					// Is collision in right direction (toward fromxy)
					if (fd < 0) { return; }

					// Are line-segments intersecting?
					if (!DoLineSegmentsIntersect(
						fromx,fromy,tox,toy,
						cl.start.x,cl.start.y,cl.end.x,cl.end.y
						)) { return; }

					// Get intersection
					if (!intersection(fromx,fromy,tox,toy, cl.start.x,cl.start.y,cl.end.x,cl.end.y, t)) {
						return;
					}

					// Determine the closest intersecting collisionline
					var distance = t.distanceTo(fromx,fromy);
					if (!c || c.distance > distance) {
						c = { collidable: collidable, cl: cl, distance: distance, x: t.x, y: t.y };
					}
				}
			});
			return c;
		}
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

	function Player() {
		this.position = new Vector(1,1);
		this.velocity = new Vector(1,0);
		this.collisionRadius = 40;
		this.airtime = 0;
		this.jumping = false;
		this.diving = false;
	}
	(function(p) {
		p.updatable = true;
		p.collide = true;
		p.foreground = true;
		p.update = function(dt) {
			var me = this;
			this.velocity.x = 0.85*this.velocity.x + 0.15*slide(g.keys.left,g.keys.right)*500;
			this.velocity.y = 0.85*this.velocity.y + 0.15*slide(g.keys.up,g.keys.down)*500;
			this.velocity.y += 5000*dt;
			this.position.add(this.velocity.x*dt,this.velocity.y*dt);
		};
		p.drawForeground = function(g) {
			var me = this;
			g.drawImage(images.mafkees,this.position.x,this.position.y);
		};

	})(Player.prototype);

	function Wall(x,y,w,h,angle,image) {
		this.x = x;
		this.y = y;
		this.angle = angle;
		this.image = image;

		var right = new Vector(Math.cos(angle),Math.sin(angle));
		var top = new Vector(0,0).setV(right).normalRight();

		var hw = w*0.5;
		var hh = h*0.5;

		right.multiply(hw);
		top.multiply(hh);

		StaticCollidable.call(this,[
			new Vector(x,y).addV(right).substractV(top),
			new Vector(x,y).addV(right).addV(top),
			new Vector(x,y).substractV(right).addV(top),
			new Vector(x,y).substractV(right).substractV(top)
		],false);

	}
	Wall.prototype.__proto__ = StaticCollidable.prototype;
	Wall.prototype.drawable = true;
	Wall.prototype.draw = function(g,next) {
		var me = this;
		g.rotate(me.x,me.y,me.angle,function() {
			g.drawCenteredImage(me.image,me.x,me.y);
		});
	};

	function createWall(name,w,h,image) {
		function constructor(x,y,angle) { Wall.call(this,x,y,w,h,angle,image); this.constArgs = arguments; }
		constructor.prototype.__proto__ = Wall.prototype;
		constructor.prototype.constructorName = name;
		return constructor;
	}

	var beam = createWall('beam',63,336,images.beam);
	var box = createWall('box',158,158,images.box);

	//#states
	function gameplayState(pen) {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		var time = 0;
		var scores = [];
		function enable() {
			g.chains.update.push(update);
			g.chains.draw.push(draw);
			g.on('mousedown',mousedown);
			g.on('keydown',keydown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
			g.on('keydown',keydown);
			g.removeListener('mousedown',mousedown);
		}

		function update(dt,next) {
			// Post update
			next(dt);
		}
		function draw(g,next) {
			// Draw HUD
			next(g);
		}
		function keydown(key) {
		}
		function mousedown(button) {
		}
		return me;
	}

	var player;
	g.on('levelchanged',function() {
		g.objects.handlePending();
		
		player = new Player();
		player.position.set(0,0);
		g.objects.add(player);

		g.objects.handlePending();
	});
	g.chains.draw.insertBefore(function(g,next) {
		next(g);
	},g.chains.draw.objects);

	g.on('levelunloaded',function() {
		g.objects.clear();
		g.objects.handlePending();
	});

	g.changeLevel(level1());

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
	function level1() {
		return {
			name: 'Level1',
			objects: 
			[new box(100,150,0)
			,new beam(0,300,Math.PI*0.5)],
			clone: arguments.callee,
			nextLevel: null
		};
	}

	g.changeState(gameplayState());

	g.start();
	}
});

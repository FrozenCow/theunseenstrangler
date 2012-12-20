define(['platform','game','vector','staticcollidable','linesegment','editor','required','state','level','mouse','collision','keyboard','quake','resources'],function(platform,Game,Vector,StaticCollidable,LineSegment,editor,required,state,level,mouse,collision,keyboard,quake,resources) {
	var t = new Vector(0,0);
	var t2 = new Vector(0,0);
	var rs = {
		'images': ['test','mouse','moneybag','car','safe_open','safe_closed','player_head','player_body','player_dead','player_body_strangle','player_body_drag','player_shoe','floor','wall100','wall200','wall300','wall600'],
		'audio': []
	};

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

	g.objects.lists.particle = g.objects.createIndexList('particle');
	g.objects.lists.spring = g.objects.createIndexList('spring');
	g.objects.lists.start = g.objects.createIndexList('start');
	g.objects.lists.finish = g.objects.createIndexList('finish');
	g.objects.lists.enemy = g.objects.createIndexList('enemy');
	g.objects.lists.usable = g.objects.createIndexList('usable');
	g.objects.lists.collectable = g.objects.createIndexList('collectable');
	g.objects.lists.shadow = g.objects.createIndexList('shadow');

	// Gravity.
	// g.gravity = (function() {
	// 	var me = {
	// 		enabled: true,
	// 		enable: enable,
	// 		disable: disable,
	// 		toggle: toggle
	// 	};
	// 	function enable() { me.enabled = true; }
	// 	function disable() { me.enabled = false; }
	// 	function toggle() { if (me.enabled) disable(); else enable(); }
	// 	function update(dt,next) {
	// 		g.objects.lists.particle.each(function(p) {
	// 			if (me.enabled) {
	// 				p.velocity.y += 200*dt;
	// 			}
	// 		});
	// 		next(dt);
	// 	}
	// 	g.chains.update.push(update);
	// 	return me;
	// })();

	// Camera
	(function() {
		game.camera = new Vector(0,0);
		function drawCamera(g,next) {
			g.save();
			g.context.translate(game.camera.x,game.camera.y);
			next(g);
			g.restore();
		}
		g.chains.draw.camera = drawCamera;
		g.chains.draw.insertBefore(drawCamera,g.chains.draw.objects);

		function updateCamera(dt,next) {
			game.camera.set(-player.position.x+400, -player.position.y+300);
			next(dt);
		}
		g.chains.update.camera = updateCamera;
		g.chains.update.push(updateCamera);
	})();

	// Auto-refresh
	// (function() {
	// 	var timeout = setTimeout(function() {
	// 		document.location.reload(true);
	// 	}, 3000);
	// 	g.once('keydown',function() {
	// 		disable();
	// 	});
	// 	g.once('mousemove',function() {
	// 		disable();
	// 	});
	// 	g.chains.draw.push(draw);
	// 	function draw(g,next) {
	// 		g.fillStyle('#ff0000');
	// 		g.fillCircle(800,0,30);
	// 		g.fillStyle('black');
	// 		next(g);
	// 	}
	// 	function disable() {
	// 		clearTimeout(timeout);
	// 		g.chains.draw.remove(draw);
	// 	}
	// })();

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
				while(true) {
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
					g.objects.lists.collidable.each(function(collidable) {
						handleCollisionLineSegments(collidable.collisionlines);
					});
					if (collisions.length > 0) {
						collisions.sort(function(a,b) {
							return b.offset-a.offset;
						});
						var c = collisions[0];
						o.position.add(c.normalx*(c.offset+1),c.normaly*(c.offset+1));
						var vc = o.velocity.dot(c.normalx, c.normaly);
						o.velocity.substract(c.normalx*vc, c.normaly*vc);
						o.surface = c;
						if (o.collided) { o.collided(c); }
					} else {
						break;
					}
				}
			});
		}
	}());

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

	// Draw collidables
	// (function() {
	// 	var game = g;
	// 	game.chains.draw.push(function(g,next) {
	// 		game.objects.lists.collidable.each(function(collidable) {
	// 			collidable.collisionlines.forEach(function(collisionline) {
	// 				g.strokeLine(collisionline.start.x,collisionline.start.y,collisionline.end.x,collisionline.end.y);
	// 			});
	// 		});
	// 		next(g);
	// 	});
	// })();

	// Draw walls
	// (function() {
	// 	var t = new Vector(0,0);
	// 	var t2 = new Vector(0,0);

	// 	var thickness = 30;
	// 	var hthickness = thickness*0.5;

	// 	g.on('mousedown',function(button,downx,downy) {
	// 		var c = null;

	// 		downx = downx - 400 + player.position.x;
	// 		downy = downy - 300 + player.position.y;

	// 		// Find closest wall from mouse
	// 		g.objects.lists.collidable.each(function(collidable) {
	// 			collidable.collisionlines.forEach(function(cl) {
	// 				t.setV(cl.end);
	// 				t.substractV(cl.start);
	// 				t.normalize();
	// 				t2.set(downx,downy);
	// 				t2.substractV(cl.start);
	// 				var d = t.dotV(t2);
	// 				d = Math.clamp(d,hthickness,cl.length-hthickness);
	// 				t.multiply(d);
	// 				var distance = t.distanceToV(t2);
	// 				if(!c || c.distance > distance) {
	// 					c = { d: d, distance: distance, cl: cl, collidable: collidable };
	// 				}
	// 			});
	// 		});

	// 		if (!c) { return; }

	// 		if (c.distance > 30) {
	// 			return;
	// 		}

	// 		g.chains.draw.push(drawSelection);

	// 		function drawSelection(g,next) {
	// 			t.setV(c.cl.end);
	// 			t.substractV(c.cl.start);
	// 			t.normalize();
	// 			t.multiply(c.d);
	// 			t.addV(c.cl.start);
	// 			g.strokeCircle(t.x,t.y,10);
	// 		}

	// 		g.once('mouseup',function(button,upx,upy) {
	// 			upx = upx - 400 + player.position.x;
	// 			upy = upy - 300 + player.position.y;
	// 			var newwall = [];
	// 			g.chains.draw.remove(drawSelection);

	// 			t.setV(c.cl.end);
	// 			t.substractV(c.cl.start);
	// 			t.normalize();

	// 			t2.setV(t);

	// 			t.multiply(c.d);

	// 			t.addV(c.cl.start);

	// 			newwall.push(new Vector(t.x-t2.x*hthickness,t.y-t2.y*hthickness));
	// 			newwall.push(new Vector(upx-t2.x*hthickness,upy-t2.y*hthickness));
	// 			newwall.push(new Vector(upx+t2.x*hthickness,upy+t2.y*hthickness));
	// 			newwall.push(new Vector(t.x+t2.x*hthickness,t.y+t2.y*hthickness));
	// 			g.objects.add(new StaticCollidable(newwall));
	// 		});
	// 	});
	// })();

	//#gameobjects
	function circleFiller(r) {
		return function(g) {
			g.fillCircle(this.position.x,this.position.y,r);
		};
	}
	function slide(a,b) { return (a?0:1)-(b?0:1); }
	function Person() {
		this.position = new Vector(1,1);
		this.velocity = new Vector(0,0);
		this.facing = new Vector(1,0);
		this.firetime = 0;
		this.collisionRadius = 30;
		this.touchRadius = 20;
		this.travelled = 0;
	}
	(function(p) {
		var t = new Vector();
		p.updatable = true;
		p.drawable = true;
		p.collide = true;
		p.touchable = true;
		p.draw = function(g) {
			this.drawPerson(g);
		};
		p.drawPerson = function(g,body) {
			body = body || images.player_body;
			var a = Math.atan2(this.facing.y,this.facing.x);
			var me = this;
			g.rotate(me.position.x,me.position.y,a,function() {
				g.drawCenteredImage(images.player_shoe,me.position.x+10+Math.cos(me.travelled/7)*10,me.position.y+10);
				g.drawCenteredImage(images.player_shoe,me.position.x+10+Math.cos(Math.PI+me.travelled/7)*10,me.position.y-10);
				g.drawCenteredImage(body,me.position.x,me.position.y);
				g.drawCenteredImage(images.player_head,me.position.x,me.position.y);
			});
		}
		p.updateMovement = function(dt,dx,dy,speed) {
			// Movement
			t.set(dx,dy);
			t.normalizeOr(0,0);
			t.multiply(speed);
			this.velocity.addV(t);
			this.travelled += t.length();

			this.velocity.multiply(0.7);
			t.setV(this.velocity);
			this.position.addV(t);
		};
		p.die = function() {
			if (this.died) { return; }
			this.died = true;
			g.objects.remove(this);
			g.objects.add(new DeadBody(this.position.x,this.position.y));
		};
	})(Person.prototype);

	function Player() {
		Person.call(this);
		this.changeState(controlState(this));
		this.score = 0;
	}
	(function(p) {
		p.__proto__ = Person.prototype;
		p.update = function(dt) {
			this.state.update(dt);
		};
		p.useInFront = function() {
			var me = this;
			var usables = me.getUsablesInFront();
			console.log(usables);
			if (usables.length === 0) { return; }
			var usable = usables[0];
			if (usable.draggable) {
				me.changeState(dragbodyState(me,usable));
			} else if (usable instanceof Enemy) {
				me.changeState(stranglingState(me,usable));
			} else if (usable instanceof Safe) {
				me.changeState(unlocksafeState(me,usable));
			} else if (usable instanceof Vehicle) {
				g.changeState(scorescreenState());
			}
		};
		p.getUsablesInFront = function() {
			var me = this;
			var r = [];
			g.objects.lists.usable.each(function(usable,BREAK) {
				if (me.hasInFront(usable)) {
					r.push(usable);
				}
			});
			return r;
		};
		p.hasInFront = function(other) {
			var me = this;
			return other.position.distanceToV(me.position) < me.touchRadius+other.touchRadius+10
				&& g.cantrace(me.position.x,me.position.y,other.position.x,other.position.y)
				&& me.facing.dot(me.position.x-other.position.x,me.position.y-other.position.y) < 0;
		};		
		p.changeState = function(state) {
			if (this.state) { this.state.disable(); }
			this.state = state;
			if (this.state) { this.state.enable(); }
		};
		p.action = function() {
			if (this.state.action) { this.state.action(); }
		};
		p.draw = function(g) {
			var me = this;
			if (me.state.draw) {
				me.state.draw(g,function(g) {
					Person.prototype.draw.call(me,g);
				});
			} else {
				Person.prototype.draw.call(me,g);
			}
		};
		p.drawProgress = function(g,progress) {
			g.fillStyle('rgba(255,255,255,0.5)');
			g.fillLoading(this.position.x,this.position.y,15,progress);
			g.fillStyle('black');
		};
		p.die = function() {
			Person.prototype.die.call(this);
			g.objects.handlePending();
			g.changeState(diedState());
		};
	})(Player.prototype);

	(function() {
		g.chains.draw.push(function(g,next) {
			var me = player;
			var usables = me.getUsablesInFront();
			usables.forEach(function(usable) {
				function drawMessage(str) {
					g.context.font = 'bold 10pt arial';
					g.fillStyle('white');

					var x = usable.x || usable.position.x;
					var y = usable.y || usable.position.y;
					x += me.position.x;
					y += me.position.y;
					x *= 0.5;
					y *= 0.5;
					y += 10;
					g.context.fillText(str,x,y);
					g.drawCenteredImage(images.mouse,x-16,y);
					g.fillStyle('black');
				}
				if (usable.draggable) {
					drawMessage('Drag');
				} else if (usable instanceof Enemy) {
					drawMessage('Strangle');
				} else if (usable instanceof Safe) {
					drawMessage('Unlock');
				} else if (usable instanceof Vehicle) {
					drawMessage('Exit level');
				}
			});
			next(g);
		});
	})();

	function controlState(me) {
		return {
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				var speed = g.keys.shift
					? 3
					: 1;
				me.updateMovement(dt,slide(g.keys.a,g.keys.d),slide(g.keys.w,g.keys.s),speed);

				// Facing
				t.set(g.mouse.x-400,g.mouse.y-300);
				t.normalizeOr(1,0);
				me.facing.setV(t);
			},
			action: function() {
				me.useInFront();
			}
		};
	}

	function stranglingState(me,enemy) {
		return {
			enable: function() {
				me.strangling = enemy;
				enemy.strangler = me;
				enemy.changeState(this.strangleState = strangleState(enemy,this));
			},
			disable: function() {
				me.strangling = null;
				enemy.strangler = null;
			},
			done: function() {
				me.changeState(controlState(me));
			},
			update: function(dt) {

			},
			action: function() {
				// TODO: rapidly tap to succesfully strangle
			},
			draw: function(g,next) {
				//next(g);
				me.drawPerson(g,images.player_body_strangle);
				me.drawProgress(g,this.strangleState.progress);
			}
		};
	}

	function dragbodyState(me,body) {
		var t = new Vector(0,0);
		return {
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				me.updateMovement(dt,slide(g.keys.a,g.keys.d),slide(g.keys.w,g.keys.s),1);
				t.setV(body.position);
				t.substractV(me.position);
				var d = t.length();
				t.normalizeOr(0,1);
				t.multiply(Math.min(d,20));
				t.addV(me.position);
				body.position.setV(t);
				me.facing.setV(body.position);
				me.facing.substractV(me.position);
				me.facing.normalize();
				if (body.collectable) {
					if (vehicle.position.distanceToV(body.position) < (vehicle.touchRadius+body.touchRadius)) {
						body.collect();
						me.score += 1000;
						me.changeState(controlState(me));
					}
				}
			},
			action: function() {
				me.changeState(controlState(me));
			},
			draw: function(g,next) {
				me.drawPerson(g,images.player_body_drag);
			}
		};
	}

	function unlocksafeState(me,safe) {
		var time = 3;
		return {
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				time -= dt;
				if (time < 0) {
					safe.unlock(me);
					me.changeState(controlState(me));
				}
			},
			draw: function(g,next) {
				me.drawPerson(g,images.player_body_drag);
				me.drawProgress(g,1-time/3);
			}
		};
	}

	function Bullet(owner,x,y,vx,vy) {
		this.owner = owner;
		this.position = new Vector(x,y);
		this.velocity = new Vector(vx,vy);
		this.collisionRadius = this.touchRadius = 5;
		this.lifetime = 3;
	}
	(function(p) {
		p.updatable = true;
		p.drawable = true;
		p.collide = true;
		p.touchable = true;
		p.draw = function(g) {
			g.fillCircle(this.position.x,this.position.y,5);
		};
		p.update = function(dt) {
			this.lifetime -= dt;
			if (this.lifetime < 0) { this.destroy(); }
			this.position.addV(this.velocity);
		};
		p.collided = function(s) {
			this.destroy();
		};
		p.touch = function(other) {
			if (other instanceof Person && this.owner !== other) {
				this.destroy();
				other.die();
			}
		};
		p.destroy = function() {
			if (this.destroyed) { return; }
			g.objects.remove(this);
			this.destroyed = true;
		};
	})(Bullet.prototype);

	function Enemy(x,y,defaultState) {
		Person.call(this);
		this.position.set(x,y);
		this.facing.rotate(x);
		this.alertness = 0;
		this.defaultState = defaultState;
		this.changeState(defaultState(this));
	}
	(function(p) {
		var t = new Vector(0,0);
		p.__proto__ = Person.prototype;
		p.enemy = true;
		p.usable = true;
		p.draw = function(g) {
			Person.prototype.draw.call(this,g);
		};
		p.update = function(dt) {
			var cantrace = this.cantraceplayer = game.cantrace(this.position.x,this.position.y,player.position.x,player.position.y);

			var distance = this.position.distanceToV(player.position);
			t.setV(player.position);
			t.substractV(this.position);
			t.normalizeOr(1,0);
			var insight_angle = Math.clamp(this.facing.dotV(t),0,1);
			var insight_distance = Math.clamp((1.0/distance),0,1)*15;
			var hearing = (Math.clamp(player.velocity.length(),5,6)-5) * ((1.0/distance)*10);

			if (cantrace) {
				this.alertness += insight_angle * insight_distance;
				this.alertness += hearing;
			}

			this.state.update(dt);
			this.alertness = Math.clamp(this.alertness-dt*0.1,0,2.5);
		};
		p.changeState = function(state) {
			if (this.state) { this.state.disable(); }
			this.state = state;
			if (this.state) { this.state.enable(); }
		};
		p.touch = function(other) {
			if (this.state.touch) { this.state.touch(other); }
		};
		p.rotateToward = function(dt,x,y) {
			t.set(x,y);
			t.substractV(this.position);
			t.normalizeOr(1,0);
			var a = this.facing.angleToward(t.x,t.y);
			var rotation = Math.sign(a)*dt*Math.PI*2
			if (Math.abs(rotation) > Math.abs(a)) {
				this.facing.setV(t);
			} else {
				this.facing.rotate(rotation)
			}
		};
		p.noticedPlayer = function(x,y) {
			return this.changeState(notifyothersState(this,x,y));
		};
	})(Enemy.prototype);

	function idleState(me) {
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				if (me.alertness >= 2) {
					return me.changeState(attackState(me));
				} else if (me.alertness >= 1) {
					return me.noticedPlayer(player.position.x,player.position.y);
				}
			}
		};
	}
	function patrolStateF(ps) {
		return function(me) {
			return patrolState(me,ps);
		};
	}
	function patrolState(me,ps) {
		var t = new Vector(0,0);
		var nextPositionIndex = null;
		return {
			clone: arguments.callee,
			enable: function() {
				var c = null;
				for(var i=0;i<ps.length;i++) {
					var distance = ps[i].distanceToV(me.position);
					if (!c || c.distance > distance) {
						c = { distance: distance, index: i };
					}
				}
				nextPositionIndex = c.index;
			},
			disable: function() { },
			update: function(dt) {
				if (me.alertness >= 2) {
					return me.changeState(attackState(me));
				} else if (me.alertness >= 1) {
					return me.noticedPlayer(player.position.x,player.position.y);
				}

				var p = ps[nextPositionIndex];
				if (me.position.distanceToV(p) < 30) {
					p = ps[nextPositionIndex = (nextPositionIndex+1) % ps.length];
				}
				me.rotateToward(dt,p.x,p.y);
				me.updateMovement(dt,me.facing.x,me.facing.y,0.5);
			}
		};
	}

	function walkState(me,px,py,nextState) {
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				if (me.alertness >= 2) {
					return me.changeState(attackState(me));
				} else if (me.alertness >= 1) {
					return me.noticedPlayer(player.position.x,player.position.y);
				} else if (me.position.distanceTo(px,py) < 30) {
					return me.changeState(nextState());
				}

				me.rotateToward(px,py);
				me.updateMovement(dt,me.facing.x,me.facing.y,0.7);
			}
		};
	}

	function waitState(me,time,nextState) {
		var waitTime;
		return {
			clone: arguments.callee,
			enable: function() { waitTime = time; },
			disable: function() { },
			update: function(dt) {
				waitTime -= dt;
				if (me.alertness >= 2) {
					return me.changeState(attackState(me));
				} else if (me.alertness >= 1) {
					return me.noticedPlayer(player.position.x,player.position.y);
				} else if (waitTime <= 0) {
					return me.changeState(nextState());
				}
			}
		};
	}

	function attackState(me) {
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				if (!me.cantraceplayer) {
					return me.noticedPlayer(player.position.x,player.position.y);
				} else if (me.alertness < 1) {
					return me.changeState(me.defaultState(me));
				}
				me.rotateToward(dt,player.position.x,player.position.y);
				me.updateMovement(dt,me.facing.x,me.facing.y,3);
			},
			touch: function(other) {
				if (other === player) {
					other.die();
				}
			}
		};
	}

	function investigateState(me,px,py) {
		var time = 3;
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				time -= dt;
				if (me.cantraceplayer) {
					me.changeState(attackState(me));
				} else if (me.position.distanceTo(px,py) < 30) {
					return me.changeState(me.defaultState(me));
				} else if (time < 0) {
					return me.changeState(me.defaultState(me));
				}
				me.rotateToward(dt,px,py);
				me.updateMovement(dt,me.facing.x,me.facing.y,3);
			}
		};
	}

	function notifyothersState(me,px,py) {
		var time = 0.5;
		return {
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				time -= dt;
				if (time < 0) {
					notify();
					me.changeState(investigateState(me,px,py));
				}
			}
		};
		function notify() {
			g.objects.lists.enemy.each(function(enemy) {
				if (me === enemy) { return; }
				if (enemy.position.distanceToV(me.position) < 800) {
					console.log('hallo');
					enemy.changeState(investigateState(enemy,px,py));
				}
			});
		}
	}

	function strangleState(me,stranglingState) {
		var strangleTime = 1.5;
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				strangleTime -= dt;
				this.progress = 1-strangleTime / 1.5;
				if (strangleTime < 0) {
					me.die();
					stranglingState.done();
				}
			}
		};
	}

	function DeadBody(x,y,angle) {
		this.position = new Vector(x,y);
		this.touchRadius = 20;
		this.backposition = new Vector(x+100,y);
	}
	(function(p) {
		var t = new Vector(0,0);
		p.drawable = true;
		p.usable = true;
		p.draggable = true;
		p.draw = function(g) {
			var me = this;
			t.setV(me.backposition);
			t.substractV(me.position);
			var angle = Math.atan2(t.y,t.x);
			if (t.length() > 100) {
				t.normalize();
				t.multiply(100);
				t.addV(me.position);
				me.backposition.setV(t);
			}
			g.rotate(me.position.x,me.position.y,angle,function() {
				g.drawImage(images.player_dead,me.position.x-25,me.position.y-75);
			});
		};
	})(DeadBody.prototype);

	function Safe(x,y,angle) {
		this.position = new Vector(x,y);
		this.angle = angle;
		this.touchRadius = 30;
		this.constArgs = arguments;
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draw = function(g) {
			var me = this;
			g.rotate(me.position.x,me.position.y,me.angle,function() {
				g.drawCenteredImage(me.usable ? images.safe_closed : images.safe_open,me.position.x+15,me.position.y);
			});
		};
		p.unlock = function(unlocker) {
			// Reindex safe, since it is no longer usable.
			g.objects.remove(this);
			g.objects.handlePending();
			this.usable = false;
			g.objects.add(this);
			var v = new Vector(1,0).rotate(this.angle).multiply(this.touchRadius+20).addV(this.position);
			g.objects.add(new MoneyBag(v.x,v.y));
		};
	})(Safe.prototype);

	function MoneyBag(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 20;
		this.constArgs = arguments;
		this.backposition = new Vector(x+70,y);
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draggable = true;
		p.collectable = true;
		p.draw = function(g) {
			var me = this;
			t.setV(me.backposition);
			t.substractV(me.position);
			var angle = Math.atan2(t.y,t.x);
			if (t.length() > 70) {
				t.normalize();
				t.multiply(70);
				t.addV(me.position);
				me.backposition.setV(t);
			}
			g.rotate(me.position.x,me.position.y,angle,function() {
				g.drawImage(images.moneybag,me.position.x-25,me.position.y-75);
			});
		};
		p.collect = function() {
			g.objects.remove(this);
		};
	})(MoneyBag.prototype);

	function Vehicle(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 95;
		this.constArgs = arguments;
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draw = function(g) {
			g.drawCenteredImage(images.car,this.position.x,this.position.y);
		};
	})(Vehicle.prototype);

	function Building(x,y,w,h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		StaticCollidable.call(this,[
			new Vector(x,y),
			new Vector(x,y+h),
			new Vector(x+w,y+h),
			new Vector(x+w,y)
		],true);
		this.constArgs = arguments;
	}
	Building.prototype.__proto__ = StaticCollidable.prototype;
	Building.prototype.draw = function(g,next) {
		var pattern = g.context.createPattern(images.floor,'repeat');
		g.fillStyle(pattern);
		g.fillRectangle(this.x,this.y,this.w,this.h);
		g.fillStyle('black');
	};

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

	var Wall100 = createWall('Wall100',30,108*1,images.wall100);
	var Wall200 = createWall('Wall200',30,108*2,images.wall200);
	var Wall300 = createWall('Wall300',30,108*3,images.wall300);
	var Wall600 = createWall('Wall600',30,108*6,images.wall600);


	//# leveleditor
	function leveleditorState() {
		var me = {
			enable: enable,
			disable: disable
		};
		var constructors = [Wall100,Wall200,Wall300,Wall600,Safe,MoneyBag,Vehicle];
		var placeConstructor = Wall300;
		var placeAngle = 0;

		function enable() {
			g.chains.update.unshift(update);
			g.chains.draw.push(draw);
			g.on('mousedown',mousedown);
			g.on('keydown',keydown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
			g.removeListener('mousedown',mousedown);
			g.removeListener('keydown',keydown);
		}
		function update(dt,next) {
			var s = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0);
			placeAngle += s * dt;
			var cameraSpeed = 200*dt;
			g.camera.add(
				((g.keys.a?1:0)-(g.keys.d?1:0))*cameraSpeed,
				((g.keys.w?1:0)-(g.keys.s?1:0))*cameraSpeed
			);
			g.objects.handlePending();
		}
		function draw(g,next) {
			next(g);
			var o = createObject();
			o.draw(g);
		}

		function getAngle() {
			var d = Math.PI/8;
			return g.keys.space
				? placeAngle
				: parseInt(placeAngle/d)*d;
		}
		function getMousePosition() {
			var v = new Vector(game.mouse.x,game.mouse.y);
			v.substractV(game.camera);
			return v;
		}
		function createObject() {
			var v = getMousePosition();
			v.x = parseInt(v.x);
			v.y = parseInt(v.y);
			return new placeConstructor(v.x,v.y,getAngle());
		}
		function mousedown(button) {
			if (button === 0) {
				g.objects.add(createObject());
			} else if (button === 2) {
				g.objects.objects.each(function(o,BREAK) {
					var v;
					if (o.x) { v = new Vector(o.x,o.y); }
					else if (o.position) { v = o.position; }
					else { return; }
					console.log(v.distanceToV(getMousePosition()));
					if (v.distanceToV(getMousePosition()) < 30) {
						g.objects.remove(o);
						return BREAK;
					}
				});
			}
		}
		function keydown(key) {
			function select(s) {
				var i =constructors.indexOf(placeConstructor);
				i = ((i + s) + constructors.length) % constructors.length;
				placeConstructor = constructors[i];
			}
			console.log('hallo!');
			if (key === 'm') select(1);
			if (key === 'n') select(-1);
		}
		return me;
	}

	//# level
	// var enemies = [1].map(function() {
	// 	var enemy = new Enemy(200,400,function(me) {
	// 		return patrolState(me,[
	// 		new Vector(500,500),
	// 		new Vector(200,500),
	// 		new Vector(200,300),
	// 		new Vector(500,300)
	// 		]);
	// 	});
	// 	g.objects.add(enemy);
	// 	return enemy;
	// });

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
			g.on('mousedown',mousedown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
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
		function mousedown(button) {
			if (button === 0) { player.action(); }
			if (button === 2) {

			}
		}
		return me;
	}

	function diedState() {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		function enable() {
			console.log('score!');
			g.chains.update.unshift(update);
			g.chains.draw.unshift(draw);
			g.on('mousedown',mousedown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
			g.removeListener('mousedown',mousedown);
		}
		function update(dt,next) {
			// Disable updating
		}
		function draw(g,next) {
			next(g);
			g.fillStyle('rgba(0,0,0,0.5)');
			g.fillRectangle(0,0,800,600);
			g.fillStyle('black');

			g.context.font = '20pt arial';
			g.fillStyle('white');
			g.fillCenteredText('You died!',400,300);
			g.fillCenteredText('Click to restart',400,400);
		}
		function mousedown() {
			g.changeState(gameplayState());
			g.restartLevel();
		}
		return me;
	}

	function scorescreenState() {
		var me = {
			enabled: false,
			enable: enable,
			disable: disable
		};
		function enable() {
			console.log('score!');
			g.chains.update.unshift(update);
			g.chains.draw.unshift(draw);
			g.on('mousedown',mousedown);
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
			g.removeListener('mousedown',mousedown);
		}
		function update(dt,next) {
			// Disable updating
		}
		function draw(g,next) {
			next(g);
			g.fillStyle('rgba(0,0,0,0.5)');
			g.fillRectangle(0,0,800,600);
			g.fillStyle('black');

			g.context.font = '20pt arial';
			g.fillStyle('white');
			g.fillCenteredText('Score: '+player.score,400,300);
			g.fillCenteredText('Sorry but I didn\'t have time for more levels!',400,400);
		}
		function mousedown() {
			g.changeState(gameplayState());
			g.nextLevel();
		}
		return me;
	}

	function menuState(callback) {
		var me;

		var overlay = document.createElement('div');
		overlay.className = 'overlay';
		overlay.style.background = 'rgba(0,0,0,0.5)';

		var menuDiv = document.createElement('div');
		menuDiv.className = 'menu';
		overlay.appendChild(menuDiv);

		var container = menuDiv;

		createButton('Export',function() {
			g.export();
		});
		createButton('Level editor',function() {
			g.changeState(leveleditorState());
		});
		var c = document.createElement('div');
		menuDiv.appendChild(c);
		if (callback) {
			createSeparator();
			createButton('Back to game',function() {
				disable();
			});
		}
		container = c;

		function createButton(text,onclick) {
			var b = document.createElement('button');
			b.textContent = text;
			b.onclick = onclick;
			container.appendChild(b);
			return b;
		}

		function createSeparator() {
			var s = document.createElement('div');
			s.className = 'separator';
			container.appendChild(s);
			return s;
		}

		function enable() {
			me.enabled = true;
			game.canvas.parentNode.insertBefore(overlay,game.canvas);
			overlay.setAttribute('tabIndex', '1');
			overlay.focus();
		}
		function disable() {
			console.log('disable');
			overlay.parentNode.removeChild(overlay);
			game.canvas.focus();
			me.enabled = false;
			if (callback) { callback(); }
		}
		return me = {
			enabled: false,
			enable: enable,
			disable: disable,
			overlay: overlay,
			menu: menuDiv,
			createButton: createButton,
			createSeparator: createSeparator
		};
	}

	var ingameMenu;
	g.on('keydown',function(key) {
		if (key === 'escape' && !ingameMenu) {
			ingameMenu = menuState(function() {
				ingameMenu = null;
			});
			if (game.state.menuhandler) { game.state.menuhandler(ingameMenu); }
			ingameMenu.enable();
		}
	});

	// Export Static
	(function() {
		function levelToString() {
			var objects = [];
			g.objects.objects.each(function(c) {objects.push(c);});
			objects = objects.filter(function(o) { return o.constArgs; });
			function getConstructorName(o) {
				console.log(o);
				return o.constructorName || /function (\w+)/.exec(o.__proto__.constructor.toString())[1];
			}
			function toArray(arr) {
				return Array.prototype.slice.call(arr,0);
			}
			return '['+objects.map(function(o) {
				return 'new '+getConstructorName(o)+'('+toArray(o.constArgs).map(function(arg) {
					return arg.toString();
				}).join(',')+')';
			}).join(',')+']';
		}
		g.export = function() {
			console.log(levelToString());
		};
	})();

	var player;
	var vehicle;
	var building;
	g.on('levelchanged',function() {
		player = new Player();
		player.position.set(100,200);
		g.objects.add(player);
		g.objects.objects.each(function(o) {
			if (o.__proto__.constructor === Vehicle) {
				vehicle = o;
			}
			if (o.__proto__.constructor === Building) {
				building = o;
			}
		});
	});
	g.chains.draw.insertBefore(function(g,next) {
		building.draw(g);
		next(g);
	},g.chains.draw.objects);

	g.on('levelunloaded',function() {
		g.objects.clear();
		g.objects.handlePending();
	});

	g.changeLevel(testlevel());
	//#levels
	function testlevel() {
		return {
			name: 'Test',
			objects: [
				new Safe(498,250,-0.2170000000000002),
				new Safe(807,604,-2.8829999999999942),
				new Vehicle(100,80,0),
				new Wall100(369,507,0),
				new Wall100(799,310,1.5707963267948966),
				new Wall200(559,310,1.5707963267948966),
				new Wall600(531,438,1.5707963267948966),
				new Wall100(54,435,1.5707963267948966),
				new Wall300(161,306,1.5707963267948966),
				new Wall300(437,162,0),
				new Building(0,0,855,650)
			].concat([
				new Enemy(297,396,patrolStateF([
					new Vector(297,396),
					new Vector(27,394),
					new Vector(28,346),
					new Vector(295,345)
				])),
				new Enemy(431,497,patrolStateF([
					new Vector(431,497),
					new Vector(430,618),
					new Vector(698,620),
					new Vector(693,494)
				])),
				new Enemy(672,239,patrolStateF([
					new Vector(672,239),
					new Vector(527,66),
					new Vector(798,75)
				]))
			]),
			clone: arguments.callee,
			nextLevel: null
		};
	}

	g.changeState(gameplayState());

	g.start();
	}
});

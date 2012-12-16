define(['platform','game','vector','staticcollidable','linesegment','editor','required','state','level','mouse','collision','keyboard','quake','resources'],function(platform,Game,Vector,StaticCollidable,LineSegment,editor,required,state,level,mouse,collision,keyboard,quake,resources) {
	var t = new Vector(0,0);
	var t2 = new Vector(0,0);
	var rs = {
		'images': ['test'],
		'audio': []
	};

	var g,game;
	platform.once('load',function() {
		var canvas = document.getElementById('main');
		game = g = new Game(startGame, canvas, [required(['chrome']),mouse,keyboard,resources(rs),state,level,collision,quake]);
		g.resources.status.on('changed',function() {
			g.graphics.context.clearRect(0,0,800,600);
			g.graphics.context.fillStyle = 'black';
			g.graphics.context.font = 'monospace';
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
	g.objects.lists.body = g.objects.createIndexList('body');
	g.objects.lists.usable = g.objects.createIndexList('usable');
	g.objects.lists.collectable = g.objects.createIndexList('collectable');

	// Gravity.
	g.gravity = (function() {
		var me = {
			enabled: true,
			enable: enable,
			disable: disable,
			toggle: toggle
		};
		function enable() { me.enabled = true; }
		function disable() { me.enabled = false; }
		function toggle() { if (me.enabled) disable(); else enable(); }
		function update(dt,next) {
			g.objects.lists.particle.each(function(p) {
				if (me.enabled) {
					p.velocity.y += 200*dt;
				}
			});
			next(dt);
		}
		g.chains.update.push(update);
		return me;
	})();

	// Camera
	(function() {
		g.chains.draw.insertBefore(function(g,next) {
			g.save();
			g.context.translate(-player.position.x+400, -player.position.y+300);
			next(g);
			g.restore();
		},g.chains.draw.objects);
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
	(function() {
		var game = g;
		game.chains.draw.push(function(g,next) {
			game.objects.lists.collidable.each(function(collidable) {
				collidable.collisionlines.forEach(function(collisionline) {
					g.strokeLine(collisionline.start.x,collisionline.start.y,collisionline.end.x,collisionline.end.y);
				});
			});
			next(g);
		});
	})();

	// Draw walls
	(function() {
		var t = new Vector(0,0);
		var t2 = new Vector(0,0);

		var thickness = 30;
		var hthickness = thickness*0.5;

		g.on('mousedown',function(button,downx,downy) {
			var c = null;

			downx = downx - 400 + player.position.x;
			downy = downy - 300 + player.position.y;

			// Find closest wall from mouse
			g.objects.lists.collidable.each(function(collidable) {
				collidable.collisionlines.forEach(function(cl) {
					t.setV(cl.end);
					t.substractV(cl.start);
					t.normalize();
					t2.set(downx,downy);
					t2.substractV(cl.start);
					var d = t.dotV(t2);
					d = Math.clamp(d,hthickness,cl.length-hthickness);
					t.multiply(d);
					var distance = t.distanceToV(t2);
					if(!c || c.distance > distance) {
						c = { d: d, distance: distance, cl: cl, collidable: collidable };
					}
				});
			});

			if (!c) { return; }

			if (c.distance > 30) {
				return;
			}

			g.chains.draw.push(drawSelection);

			function drawSelection(g,next) {
				t.setV(c.cl.end);
				t.substractV(c.cl.start);
				t.normalize();
				t.multiply(c.d);
				t.addV(c.cl.start);
				g.strokeCircle(t.x,t.y,10);
			}

			g.once('mouseup',function(button,upx,upy) {
				upx = upx - 400 + player.position.x;
				upy = upy - 300 + player.position.y;
				var newwall = [];
				g.chains.draw.remove(drawSelection);

				t.setV(c.cl.end);
				t.substractV(c.cl.start);
				t.normalize();

				t2.setV(t);

				t.multiply(c.d);

				t.addV(c.cl.start);

				newwall.push(new Vector(t.x-t2.x*hthickness,t.y-t2.y*hthickness));
				newwall.push(new Vector(upx-t2.x*hthickness,upy-t2.y*hthickness));
				newwall.push(new Vector(upx+t2.x*hthickness,upy+t2.y*hthickness));
				newwall.push(new Vector(t.x+t2.x*hthickness,t.y+t2.y*hthickness));
				g.objects.add(new StaticCollidable(newwall));
			});
		});
	})();

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
		this.collisionRadius = this.touchRadius = 20;
	}
	(function(p) {
		var t = new Vector();
		p.updatable = true;
		p.drawable = true;
		p.collide = true;
		p.touchable = true;
		p.draw = function(g) {
			g.fillCircle(this.position.x,this.position.y,this.collisionRadius);
			t.setV(this.facing);
			t.multiply(this.collisionRadius-5);
			t.addV(this.position);
			g.fillCircle(t.x,t.y,this.collisionRadius*0.5);
		};
		p.updateMovement = function(dt,dx,dy,speed) {
			// Movement
			t.set(dx,dy);
			t.normalizeOr(0,0);
			t.multiply(speed);
			this.velocity.addV(t);
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
	})(Player.prototype);

	g.on('mousedown',function(button) {
		if (button === 2) { player.action(); }
	});

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

				// Shooting
				me.firetime -= dt;
				if (g.mouse.buttons[0] && me.firetime < 0) {
					t.setV(me.facing);
					t.multiply(20);
					me.firetime = 0.1;
					g.objects.add(new Bullet(me,me.position.x,me.position.y,t.x,t.y));
				}
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
				enemy.changeState(strangleState(enemy,this));
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
						me.changeState(controlState(me));
					}
				}
			},
			action: function() {
				me.changeState(controlState(me));
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
			g.fillCenteredText(this.alertness.toFixed(2), this.position.x,this.position.y+40);
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
				me.updateMovement(dt,me.facing.x,me.facing.y,0.7);
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
		return {
			clone: arguments.callee,
			enable: function() { },
			disable: function() { },
			update: function(dt) {
				if (me.cantraceplayer) {
					me.changeState(attackState(me));
				} else if (me.position.distanceTo(px,py) < 30) {
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
				if (enemy.distanceToV(me.position) < 400) {
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
				if (strangleTime < 0) {
					me.die();
					stranglingState.done();
				}
			}
		};
	}

	function DeadBody(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 20;
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draggable = true;
		p.draw = function(g) {
			g.fillStyle('gray');
			g.fillCircle(this.position.x,this.position.y,20);
			g.fillStyle('black');
		};
	})(DeadBody.prototype);

	function Safe(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 30;
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draw = function(g) {
			var w = this.usable ? 64 : 50;
			var hw = w/2;
			g.fillStyle('#333333');
			g.fillRectangle(this.position.x-hw,this.position.y-hw,w,w);
			g.fillStyle('black');
		};
		p.unlock = function(unlocker) {
			// Reindex safe, since it is no longer usable.
			g.objects.remove(this);
			g.objects.handlePending();
			this.usable = false;
			g.objects.add(this);

			g.objects.add(new MoneyBag(this.position.x+this.touchRadius+20,this.position.y));
		};
	})(Safe.prototype);

	function MoneyBag(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 20;
	}
	(function(p) {
		p.drawable = true;
		p.usable = true;
		p.draggable = true;
		p.collectable = true;
		p.draw = function(g) {
			g.fillStyle('yellow');
			g.fillCircle(this.position.x,this.position.y,20);
			g.fillStyle('black');
		};
		p.collect = function() {
			g.objects.remove(this);
		};
	})(MoneyBag.prototype);

	function Vehicle(x,y) {
		this.position = new Vector(x,y);
		this.touchRadius = 50;
	}
	(function(p) {
		p.drawable = true;
		p.draw = function(g) {
			g.fillStyle('red');
			g.fillCircle(this.position.x,this.position.y,50);
			g.fillStyle('black');
		};
	})(Vehicle.prototype);

	var player = new Player();
	var enemies = [1].map(function() {
		var enemy = new Enemy(200,400,function(me) {
			return patrolState(me,[
			new Vector(500,500),
			new Vector(200,500),
			new Vector(200,300),
			new Vector(500,300)
			]);
		});
		g.objects.add(enemy);
		return enemy;
	});
	g.objects.add(player);
	g.objects.add(new StaticCollidable([
		new Vector(0,0),
		new Vector(0,600),
		new Vector(800,600),
		new Vector(800,0)
	],true));
	g.objects.add(new Safe(100,100));

	var vehicle = new Vehicle(300,100);
	g.objects.add(vehicle);


[new StaticCollidable([new Vector(459.6938840729227,233.02376624181719),new Vector(489.6936453206643,232.9040788218458),new Vector(555.9998806238708,287.9401562900143),new Vector(526.0001193761292,288.0598437099857)],false),new StaticCollidable([new Vector(800,199),new Vector(800,229),new Vector(596,232),new Vector(596,202)],false),new StaticCollidable([new Vector(215,234),new Vector(211.6127093586714,204.19184235630843),new Vector(486.3063546793357,203.0959211781542),new Vector(489.6936453206643,232.9040788218458)],false),new StaticCollidable([new Vector(180,190),new Vector(210,190),new Vector(215,234),new Vector(185,234)],false),new StaticCollidable([new Vector(94.03505811753999,318.4499165426997),new Vector(124,317),new Vector(129.98247094123,595.2750417286502),new Vector(100.01752905877,596.7249582713498)],false),new StaticCollidable([new Vector(0,323),new Vector(0,293),new Vector(124,287),new Vector(124,317)],false),new StaticCollidable([new Vector(179.8367347310764,158.97959890451617),new Vector(179.9946272810562,188.97918340068313),new Vector(135.0789462749899,183.99979224808348),new Vector(134.9210537250101,154.00020775191652)],false),new StaticCollidable([new Vector(179,0),new Vector(209,0),new Vector(210,190),new Vector(180,190)],false),new StaticCollidable([new Vector(0,185),new Vector(0,155),new Vector(52,155),new Vector(52,185)],false),new StaticCollidable([new Vector(800,0),new Vector(0,0),new Vector(0,600),new Vector(800,600)],true)].
	forEach(function(sc) {
		g.objects.add(sc);
	});

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
		}
		function disable() {
			g.chains.update.remove(update);
			g.chains.draw.remove(draw);
		}

		function update(dt,next) {
			// Post update
			next(dt);
		}
		function draw(g,next) {
			// Draw HUD
			next(g);
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
		createButton('Start Levels',function() {
			start(level1());
		});
		createButton('Sandbox',function() {
			start(sandboxlevel());
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
			var scs = [];
			g.objects.lists.collidable.each(function(c) {scs.push(c);});
			return '['+scs.map(function(sc) {
				return 'new StaticCollidable(['+sc.collisionlines.map(function(cl) {
					return 'new Vector('+cl.start.x+','+cl.start.y+')';
				}).join(',')+'],'+(!!sc.inverted)+')';
			}).join(',')+']';
		}
		g.export = function() {
			console.log(levelToString());
		};
	})();

	//#levels
	function testlevel() {
		return {
			name: 'Test',
			objects: [new StaticCollidable([
				new Vector(0,0),
				new Vector(0,600),
				new Vector(800,600),
				new Vector(800,0)
			],true),
			new Finish(700,400),
			new StaticText(300,100,'Tutorial','60px Permanent Marker'),
			new StaticText(300,200,'This is a creature created from blobs and muscles'),
			new StaticText(450,250,'You can control muscles by pressing the key that is next to it'),
			new StaticText(400,300,'Try pressing 1 and 2 and get to the finish'),
			new StaticText(400,325,'Press R to reset'),
			new StaticArrow(80,300,80)
			],
			creature: creatures.square,
			clone: arguments.callee,
			nextLevel: tutorial2,
			controlonly: true
		};
	}

	g.changeState(gameplayState());

	g.start();
	}
});

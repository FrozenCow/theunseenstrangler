define(['platform','game','vector','staticcollidable','editor','required','state','level','mouse','collision','keyboard','quake','resources'],function(platform,Game,Vector,StaticCollidable,editor,required,state,level,mouse,collision,keyboard,quake,resources) {
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
	g.objects.lists.collidable = g.objects.createIndexList('collidable');

	var screenCollidable = new StaticCollidable([
		new Vector(0,0),
		new Vector(0,600),
		new Vector(800,600),
		new Vector(800,0)
	],true);

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

	//#gameobjects

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
			g.removeListener('keydown',keydown);
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
			// Handle gameplay keys
			console.log(key);
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

		function start(level) {
			g.ChangeLevel(level);
			if (g.level.creature) {
				g.ChangeCreature(g.level.creature);
			} else {
				g.ChangeCreature(creatures.dot);
			}
			g.startdesign = Creature.toJson(g.creature);
			g.ChangeState((g.level.controlonly ? controlmode : designmode)());
			if (me.enabled) { disable(); }
		}

		createButton('Tutorial',function() {
			start(tutorial1());
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

	//#levels
	function testlevel() {
		return {
			name: 'Test',
			objects: [new StaticCollidable([
				new Vector(0,0),
				new Vector(0,500),
				new Vector(800,500),
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

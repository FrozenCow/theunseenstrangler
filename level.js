define(function() {
	return function(g) {
		g.level = null;
		g.changeLevel = function(level) {
			if (this.level) { this.level.objects.forEach(function(c) { g.objects.remove(c); }); }
			if (this.level.disable) { this.level.disable(); }
			this.level = level;
			if (this.level) { this.level.objects.forEach(function(c) { g.objects.add(c); }); }
			if (this.level.enable) { this.level.enable(); }
			g.objects.handlePending();
		};
		g.restartLevel = function() {
			g.changeLevel(g.level.clone());
		};
		g.nextLevel = function(level) {
			var nextLevel = level.nextLevel();
			g.changeLevel(nextLevel);
		};
	};
});
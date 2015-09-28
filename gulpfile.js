var gulp            = require('gulp'),
    manifest        = require('asset-builder')('./assets/manifest.json'),
    gulpLoadPlugins = require('gulp-load-plugins'),
    merge           = require('merge-stream'),
    argv            = require('yargs').argv,
    pngquant        = require('imagemin-pngquant'),
    browserSync     = require('browser-sync').create(),
    plugins         = gulpLoadPlugins();

var path    = manifest.paths, //path.source, path.dest etc
    globs   = manifest.globs, //globs.images, globs.bower etc
    project = manifest.getProjectGlobs(),
    config  = manifest.config || {};

function handleError(err) {
  plugins.util.log(plugins.util.colors.red('[ERROR] ' + err.toString()));
  plugins.util.beep();
  plugins.notify("An error has occured. Check the console.");
  this.emit('end');
}

//Compile SCSS to CSS
gulp.task('styles', ['sass-lint'], function() {
  var merged = merge();

  manifest.forEachDependency('css', function(dep) {
    merged.add(
      gulp.src(dep.globs)
      .pipe(plugins.if(!argv.production, plugins.sourcemaps.init())) //If NOT prod use maps
      .pipe(plugins.sass({ style: 'nested' }))
      .on('error', handleError)
      .pipe(plugins.concat(dep.name))
      .pipe(plugins.autoprefixer({
          browsers: ['last 2 versions']
        }))
      .pipe(plugins.if(argv.production, plugins.minifyCss())) //If prod minify
    );
  });
  return merged

  .pipe(plugins.if(!argv.production, plugins.sourcemaps.write('.')))
  .pipe(gulp.dest(path.dist + '/css'))
  .pipe(browserSync.reload({stream:true}))
  .pipe(plugins.if(!argv.production, plugins.notify({
      "title": "Gulp Notification",
      "subtitle": "Task Complete",
      "message": "Styles task complete",
      "sound": "Frog",
      "onLast": true,
      "wait": true
    })));
});

// Lints scss files
gulp.task('sass-lint', function() {
  return gulp.src(path.source + 'styles/**/*.scss')
    .pipe(plugins.sassLint())
    .pipe(plugins.sassLint.format())
    .pipe(plugins.if(argv.production, plugins.sassLint.failOnError()));
});

// Concatenate & Minify JS
gulp.task('scripts', ['jshint'], function() {
  var merged = merge();

  manifest.forEachDependency('js', function(dep) {
    merged.add(
      gulp.src(dep.globs, {base: 'scripts', merge: true})
        .pipe(plugins.if(!argv.production, plugins.sourcemaps.init())) //If NOT prod use maps
        .pipe(plugins.concat(dep.name))
        .pipe(plugins.if(argv.production, plugins.uglify())) //If prod minify
        .pipe(plugins.if(!argv.production, plugins.sourcemaps.write('.', {
          sourceRoot: path.scripts
        })))
    )
    .pipe(gulp.dest(path.dist + '/js'));
  });

  return merged
  .pipe(plugins.if(!argv.production, plugins.notify({
      "title": "Gulp Notification",
      "subtitle": "Task Complete",
      "message": "Scripts task complete",
      "sound": "Frog",
      "onLast": true,
      "wait": true
    })));
});

// Lints configuration JSON and project JS.
gulp.task('jshint', function() {
  return gulp.src(['bower.json', 'gulpfile.js'].concat(project.js))
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('jshint-stylish'))
    //.pipe(plugins.if(argv.production, plugins.jshint.reporter('fail'))); Currently fails on vendor scripts.
});

// Min / Crush images
gulp.task('images', function () {
  return gulp.src(globs.images)
    .pipe(plugins.imagemin({
      progressive: true,
      use: [pngquant()]
    }))
    .pipe(gulp.dest(path.dist + 'img'))
    .pipe(plugins.if(!argv.production, plugins.notify("Images task complete")));
});

// Convert SVGs to Sprites
gulp.task('svg-sprites', function () {
  return gulp.src(path.svgs + 'sprite/*.svg')
    .pipe(plugins.svgmin())
    .pipe(plugins.svgSprite({
      mode: {
        symbol: {
          dest: '.' //Sets default path (svg) and stopped the folders nesting.
        }
      }
    }))
    .pipe(gulp.dest(path.dist))
    .pipe(plugins.if(!argv.production, plugins.notify("SVG task complete")));
});

//Minify SVGS + run sprite task
gulp.task('svgs', ['svg-sprite'], function () {
  return gulp.src(path.svgs + '*.svg')
    .pipe(plugins.svgmin())
    .pipe(gulp.dest(path.dist + 'svg'))
});

// Deletes the build folder entirely.
gulp.task('clean', require('del').bind(null, [path.dist]));

// Generic build task. Use with '--production' for minified js / css
gulp.task('build', ['clean', 'images', 'svgs', 'styles', 'scripts']);

// Watch Files For Changes
gulp.task('watch', function() {

  var ghost = false;

  //if gulp watch --chill then BrowserSync will not pass clicks, forms, scroll to other browsers.
  if(argv.chill) {
    ghost = true;
  }

  browserSync.init({
    files: ['{lib,templates}/**/*.php', '*.php'],
    proxy: config.devUrl,
    ghostMode: ghost,
    snippetOptions: {
      whitelist: ['/wp-admin/admin-ajax.php'],
      blacklist: ['/wp-admin/**']
    }
  });

  plugins.util.log('Watching source files for changes... Press ' + plugins.util.colors.cyan('CTRL + C') + ' to stop.');

  gulp.watch(path.source + 'styles/**/*.scss', ['styles']).on('change', function(file) {
    plugins.util.log('File Changed: ' + file.path + '');
  });

  gulp.watch(path.source + 'scripts/*.js', ['scripts']).on('change', function(file) {
    plugins.util.log('File Changed: ' + file.path + '');
  });

});

gulp.task('default', ['build']);

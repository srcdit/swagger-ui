'use strict';

var gulp = require('gulp');
var es = require('event-stream');
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var less = require('gulp-less');
var wrap = require('gulp-wrap');
var watch = require('gulp-watch');
var connect = require('gulp-connect');
var header = require('gulp-header');
var order = require('gulp-order');
var jshint = require('gulp-jshint');
var pkg = require('./package.json');
var replace = require('gulp-replace');
var dotenv = require('dotenv').config();

var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''].join('\n');

/**
 * Clean ups ./dist folder
 */
gulp.task('clean', function() {
  return gulp
    .src('./dist', {read: false})
    .pipe(clean({force: true}))
    .on('error', log);
});

/**
 * JShint all *.js files
 */
gulp.task('lint', function () {
  return gulp.src('./src/main/javascript/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

/**
 * Build a distribution
 */
gulp.task('dist', ['clean', 'lint'], _dist);
function _dist() {
  return es.merge(
    gulp.src([
        './node_modules/es5-shim/es5-shim.js',
        './lib/sanitize-html.min.js',
        './src/main/javascript/**/*.js',
        './node_modules/swagger-client/browser/swagger-client.js'
      ]),
      gulp
        .src(['./src/main/template/templates.js'])
        .on('error', log)
    )
    .pipe(order(['scripts.js', 'templates.js']))
    .pipe(concat('swagger-ui.js'))
    .pipe(wrap('(function(){<%= contents %>}).call(this);'))
    .pipe(header(banner, { pkg: pkg }))
    .pipe(gulp.dest('./dist'))
    .pipe(uglify())
    .on('error', log)
    .pipe(rename({extname: '.min.js'}))
    .on('error', log)
    .pipe(gulp.dest('./dist'))
    .pipe(connect.reload());
}
gulp.task('dev-dist', ['lint', 'dev-copy'], _dist);

/**
 * Processes less files into CSS files
 */
gulp.task('less', ['clean'], _less);
function _less() {
  return gulp
    .src([
      './src/main/less/screen.less',
      './src/main/less/print.less',
      './src/main/less/reset.less',
      './src/main/less/style.less'
    ])
    .pipe(less())
    .on('error', function(err){ log(err); this.emit('end');})
    .pipe(gulp.dest('./src/main/html/css/'))
    .pipe(connect.reload());
}
gulp.task('dev-less', _less);

/**
 * Copy lib and html folders
 */
gulp.task('copy', ['less'], _copy);
function _copy() {
  // copy JavaScript files inside lib folder
  gulp
    .src(['./lib/**/*.{js,map}',
        './node_modules/es5-shim/es5-shim.js'
    ])
    .pipe(gulp.dest('./dist/lib'))
    .on('error', log);

  // copy `lang` for translations
  gulp
    .src(['./lang/**/*.js'])
    .pipe(gulp.dest('./dist/lang'))
    .on('error', log);

  // copy all files inside html folder
  gulp
    .src(['./src/main/html/**/*'])
    .pipe(gulp.dest('./dist'))
    .on('error', log);
}
gulp.task('dev-copy', ['dev-less', 'copy-local-specs'], _copy);

gulp.task('copy-local-specs', function () {
  // copy the test specs
  return gulp
    .src(['./test/specs/**/*'])
    .pipe(gulp.dest('./dist/specs'))
    .on('error', log);
});

/**
 * Watch for changes and recompile
 */
gulp.task('watch', ['copy-local-specs'], function() {
  return watch([
    './src/**/*.{js,less,handlebars}',
    './src/main/html/*.html',
    './test/specs/**/*.{json,yaml}'
    ],
    function() {
      gulp.start('dev-dist');
    });
});

/**
 * Live reload web server of `dist`
 */
gulp.task('connect', function() {
  connect.server({
    root: 'dist',
    livereload: true
  });
});

function log(error) {
  console.error(error.toString && error.toString());
}

gulp.task('handlebars', function () {
    gulp
        .src(['./src/main/template/templates.js'])
        .pipe(wrap('/* jshint ignore:start */ \n {<%= contents %>} \n /* jshint ignore:end */'))
        .pipe(gulp.dest('./src/main/template/'))
        .on('error', log);
});

/**
 * Replaces OAuth 2.0 parameters from environment variables.
 */
gulp.task('environment-variables', ['dist', 'copy'], function () {
    gulp
        .src(['./src/main/html/index.html'])
        .pipe(replace('http://petstore.swagger.io/v2/swagger.json', process.env.APIDOCS_ENDPOINT))
        .pipe(replace('your-client-id', process.env.OA2_CLIENT_ID))
        .pipe(replace('your-client-id', process.env.OA2_CLIENT_ID))
        .pipe(replace('your-client-secret-if-required', process.env.OA2_CLIENT_SECRET))
        .pipe(replace('your-realms', process.env.OA2_REALM))
        .pipe(replace('your-app-name', process.env.OA2_APP_NAME))
        .pipe(gulp.dest('./dist/', {overwrite: true}))

});
gulp.task('default', ['dist', 'copy', 'environment-variables']);
gulp.task('serve', ['connect', 'watch']);
gulp.task('dev', ['default'], function () {
  gulp.start('serve');
});

const gulp = require('gulp')
const sass = require('gulp-sass')(require('sass'))
const autoprefixer = require('gulp-autoprefixer')
const jade = require('gulp-jade')
const copy = require('gulp-copy')
const rimrafPromise = require('rimraf-promise')
const ghPages = require('gulp-gh-pages')
const fs = require('fs')
const path = require('path')
const connect = require('gulp-connect')
const puppeteer = require('puppeteer')
const yaml = require('js-yaml')

gulp.task('resume-sass', (done) => {
  gulp
    .src('src/scss/resume.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(
      autoprefixer({
        browsers: ['last 4 versions'],
        cascade: false
      })
    )
    .pipe(gulp.dest('dist/css/'))
    .pipe(connect.reload())
  done();
})

gulp.task('icon-sass', (done) => {
  gulp
    .src('src/scss/iconfont.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(
      autoprefixer({
        browsers: ['last 4 versions'],
        cascade: false
      })
    )
    .pipe(gulp.dest('dist/iconfont/'))
    .pipe(connect.reload())
  done();
})

gulp.task('sass:watch', (done) => {
  gulp.watch('./src/scss/resume.scss', gulp.series('resume-sass'))
  gulp.watch('./src/scss/iconfont.scss', gulp.series('icon-sass'))
  gulp.watch('./src/scss/components/*.scss', gulp.series('resume-sass'))
  done()
})

gulp.task('yaml2jade', (done) => {
  const resume = yaml.safeLoad(fs.readFileSync('./resume.yaml', 'utf-8'))
  const locals = highlight(resume)
  gulp
    .src('./src/jade/index.jade')
    .pipe(
      jade({
        locals
      })
    )
    .pipe(gulp.dest('./dist/'))
    .pipe(connect.reload())
  done()
})

gulp.task('yaml2jade:watch', (done) => {
  gulp.watch('./resume.yaml', gulp.series('yaml2jade'))
  done()
})

function src2dist(dir) {
  return gulp.src(`./src/${dir}/*.*`).pipe(gulp.dest(`./dist/${dir}/`))
}

function highlight(locals) {
  var locals = JSON.stringify(locals)
  const re = /`(.+?)`/g
  locals = locals.replace(re, '<strong>$1</strong>')
  return JSON.parse(locals)
}

gulp.task('copy', (done) => {
  src2dist('iconfont')
  src2dist('img')
  src2dist('pdf')
  gulp.src('./CNAME').pipe(gulp.dest('./dist'))
  done()
})

gulp.task('clean', (done) => {
  rimrafPromise('./dist/')
  done()
})

gulp.task('deploy', () =>
  gulp.src('./dist/**/*').pipe(
    ghPages({
      remoteUrl: 'git@github.com:lenconda/lenconda.github.io.git',
      branch: 'master'
    })
  )
)

let port = 9000

// 避免打印时，同时运行开发服务报错
gulp.task('set-pdf-port', (done) => {
  port = 9001
  done();
})

gulp.task('webserver', (done) => {
  connect.server({
    root: './dist',
    livereload: true,
    port
  })
  done()
})

gulp.task('default', gulp.series('icon-sass', 'resume-sass', 'yaml2jade', 'copy'))

gulp.task('dev', gulp.series('default', 'yaml2jade:watch', 'sass:watch', 'webserver'))

gulp.task('pdf', gulp.series('set-pdf-port', 'default', 'webserver', async (done) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  await page.setViewport({
    width: 1440,
    height: 900
  })

  await page.goto('http://localhost:9001')
  await delay(100)

  const exportPath = path.join(__dirname, './dist/pdf/resume.pdf');

  await page.pdf({
    path: exportPath,
    width: '9.64in',
    height: '26.9in',
    printBackground: true,
    displayHeaderFooter: false,
    margin: {
      top: 0,
      left: 20,
      right: 20,
      bottom: 0
    }
  })
  src2dist('pdf')
  console.log('PDF生成在 ./src/pdf 中了')
  browser.close()
  connect.serverClose()
  done()
}))

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
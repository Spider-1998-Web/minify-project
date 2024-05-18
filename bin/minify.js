#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const htmlMinifier = require('html-minifier-terser').minify;
const csso = require('csso');
const terser = require('terser');
const copydir = require('copy-dir');

const inputDir = process.cwd(); // Use current working directory as input

// Function to create directories recursively if they do not exist
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

// Define output directory
const outputDir = path.join(inputDir, 'build');

// Function to recursively scan a directory and collect file paths
function scanDirectory(directory) {
    let filepaths = [];
    const files = fs.readdirSync(directory);
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            filepaths = filepaths.concat(scanDirectory(filePath)); // Recursively scan subdirectories
        } else {
            filepaths.push(filePath);
        }
    });
    return filepaths;
}

// Scan input directory for files to process
const inputFiles = scanDirectory(inputDir);

// Process each input file
inputFiles.forEach(inputFilePath => {
    const relativePath = path.relative(inputDir, inputFilePath);
    const outputFilePath = path.join(outputDir, relativePath);

    // Ensure output directory exists
    ensureDirectoryExistence(outputFilePath);

    // Minify or copy the file based on file type
    if (path.extname(inputFilePath) === '.html') {
        // Minify HTML
        fs.readFile(inputFilePath, 'utf8', (err, htmlData) => {
            if (err) {
                console.error('Error reading HTML file:', err);
                return;
            }
            htmlMinifier(htmlData, {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeEmptyAttributes: true,
                minifyCSS: true,
                minifyJS: true,
                preserveLineBreaks: true,
                processScripts: ['text/html']
            }).then(minifiedHtml => {
                // Update references to CSS files in minified HTML
                minifiedHtml = minifiedHtml.replace(/href="((?!\.min).)*\.css"/g, (match) => {
                    return match.replace(/\.css/g, '.min.css');
                });
                // Update references to JS files in minified HTML
                minifiedHtml = minifiedHtml.replace(/src="((?!\.min).)*\.js"/g, (match) => {
                    return match.replace(/\.js/g, '.min.js');
                });

                fs.writeFile(outputFilePath, minifiedHtml, (err) => {
                    if (err) {
                        console.error('Error writing minified HTML file:', err);
                    } else {
                        console.log('HTML minified successfully:', relativePath);
                    }
                });
            }).catch(err => {
                console.error('Error during HTML minification:', err);
            });
        });
    } else if (path.extname(inputFilePath) === '.css') {
        // Minify CSS
        fs.readFile(inputFilePath, 'utf8', (err, cssData) => {
            if (err) {
                console.error('Error reading CSS file:', err);
                return;
            }
            try {
                const minifiedCss = csso.minify(cssData).css;
                const minifiedFilePath = outputFilePath.replace(/\.css$/, '.min.css');
                fs.writeFile(minifiedFilePath, minifiedCss, (err) => {
                    if (err) {
                        console.error('Error writing minified CSS file:', err);
                    } else {
                        console.log('CSS minified successfully:', relativePath);
                    }
                });
            } catch (minifyError) {
                console.error('Error during CSS minification:', minifyError);
            }
        });
    } else if (path.extname(inputFilePath) === '.js') {
        // Minify JS
        fs.readFile(inputFilePath, 'utf8', (err, jsData) => {
            if (err) {
                console.error('Error reading JS file:', err);
                return;
            }
            terser.minify(jsData).then(minifiedJs => {
                const minifiedFilePath = outputFilePath.replace(/\.js$/, '.min.js');
                fs.writeFile(minifiedFilePath, minifiedJs.code, (err) => {
                    if (err) {
                        console.error('Error writing minified JS file:', err);
                    } else {
                        console.log('JS minified successfully:', relativePath);
                    }
                });
            }).catch(err => {
                console.error('Error during JS minification:', err);
            });
        });
    } else {
        // Copy other files (e.g., images)
        copydir.sync(inputFilePath, outputFilePath, {
            utimes: true, // keep add time and modify time
            mode: true,   // keep file mode
            cover: true   // cover file when exists, default is true
        });
        console.log('File copied successfully:', relativePath);
    }
});

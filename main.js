/*jshint white: true*/

var Promise = require('bluebird'),
    bowerJson = Promise.promisifyAll(require('bower-json'), {
        filter: function (name, func, target, passesDefaultFilter) {
            var myPass = false;
            if (['read', 'find'].indexOf(name) >= 0) {
                myPass = true;
            }
            return passesDefaultFilter && myPass;
        }
    }),
    fs = Promise.promisifyAll(require('fs'));

var file = process.argv[2];

if (!file) {
    usage('You forgot the file to validate!');
    process.exit(1);
}

function usage(message) {
    console.log(message);
    console.log('bower-validate <filename>');
}

function parseRepoUrl(repoUrl) {
    var m = repoUrl.match(/.+\/(.+)$/);
    if (m) {
        return {
            name: m[1]
        };
    }
}

function parsePluginMain(pathString) {
    var path = pathString.split('/');
    return {
        path: path
    };
}

function main(file) {
    var configFilePath = file.split('/'),
        basePath = configFilePath.slice(0, configFilePath.length - 1);
    bowerJson.readAsync(file)
        .then(function (json) {
            // do more of our own checks.
            console.log('Bower config found and validated');
            return json;
        })
        .then(function (config) {
            // Check for required elements:
            var requiredProperties = [
                'name', 'description', 'keywords', 'author',
                'moduleType', 'ignore',
                'repository', 'dependencies', 'devDependencies', 'license'
            ], missingProperties = [];
            requiredProperties.forEach(function (name) {
                if (config[name] === undefined) {
                    missingProperties.push(name);
                }
            });
            if (missingProperties.length > 0) {
                throw new Error('Required config properties missing: ' + missingProperties.join(', '));
            }
            console.log('Required properties present');
            return config;
        })
        .then(function (config) {
            // check for deprected or invalid properties.
            var deprecated = [
                'version'
            ],
                deprecatedFound = deprecated.filter(function (name) {
                    if (config[name]) {
                        return true;
                    }
                    return false;
                });
            if (deprecatedFound.length > 0) {
                throw new Error('Deprecated config properties found: ' + deprecatedFound.join(', '));
            }

            return config;

        })
        .then(function (config) {
            // Validate

            // validate repo
            if (config.repository.url === undefined) {
                throw new Error('Repository url is missing');
            }
            var repo = parseRepoUrl(config.repository.url);
            if (repo === undefined) {
                throw new Error('Invalid repository url');
            }

            // name should be the same as the repo name
            if (repo.name !== config.name) {
                throw new Error('Bower name (' + config.name + ') should be the same as the repo name (' + repo.name + ')');
            }
            console.log('Repo name and bower name match: ' + config.name);

            // if module type is kbase-ui-plugin, verify that the config.yml is pointed to
            switch (config.moduleType) {
                case 'kbase-ui-plugin':
                    if (typeof config.name !== 'string') {
                        throw new Error('The "main" property for module type kbase-ui-plugin must be a string');
                    }
                    var main = parsePluginMain(config.main),
                        configFile = main.path[main.path.length - 1];

                    if (configFile !== 'config.yml') {
                        throw new Error('The plugin config file is not specified correctly in the main property');
                    }

		    var pluginConfigPath = basePath.concat(main.path).join('/');

                    if (!fs.existsSync(pluginConfigPath)) {
                        throw new Error('Plugin config file not found: ' + pluginConfigPath);
                    }

                    console.log('Plugin config file found');
                    break;
                case 'amd-library':
                    // A collection of amd modules, no single entry point.
                    // May have an install.yml which tells the client what how to handle the files.
                    break;
                default:
                    if (config.main === undefined) {
                        console.log('Unhandled module type, main entry point not enforced: ' + config.moduleType);
                    }
            }


            // even validate the plugin integrity???

            // author is ... 

            // validate dependencies and dev dependencies -- poke bower registry

            // license, should refer to license file, which should exist
            var licenseFile;
            if (config.license === 'LICENSE.md' ||
                config.license === 'SEE LICENSE IN LICENSE.md') {
                console.log('License property is correctly formed');
                licenseFile = 'LICENSE.md';
            } else if (config.license === 'LICENSE' ||
                       config.license === 'SEE LICENSE IN LICENSE') {
                console.log('License property is correctly formed');
                licenseFile = 'LICENSE';
            } else {
                throw new Error('Lisense property not correctly specified.');
            }
                
            if (!fs.existsSync(basePath.concat([licenseFile]).join('/'))) {
                throw new Error('License file not found: ' + basePath.concat([licenseFile]).join('/'));
            }
           
            console.log('License file found: ' + licenseFile);

        })
        .catch(function (err) {

            console.log('Error loading and validating Bower config: ' + file);
            console.log(err);
        });
}


main(file);

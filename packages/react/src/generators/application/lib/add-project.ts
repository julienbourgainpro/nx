import { NormalizedSchema } from '../schema';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { maybeJs } from '../../../utils/maybe-js';
import { hasRspackPlugin } from '../../../utils/has-rspack-plugin';
import type { PackageJson } from 'nx/src/utils/package-json';

export function addProject(host: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  if (options.bundler === 'webpack') {
    if (!hasWebpackPlugin(host) || !options.addPlugin) {
      project.targets = {
        build: createBuildTarget(options),
        serve: createServeTarget(options),
      };
    }
  } else if (
    options.bundler === 'rspack' &&
    (!hasRspackPlugin(host) || !options.addPlugin)
  ) {
    project.targets = {
      build: createRspackBuildTarget(options),
      serve: createRspackServeTarget(options),
    };
  }

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
    }
    if (Object.keys(project.targets).length) {
      packageJson.nx ??= {};
      packageJson.nx.targets = project.targets;
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    // React Router already adds a package.json to the project root
    if (options.useReactRouter) {
      updateJson(
        host,
        joinPathFragments(options.appProjectRoot, 'package.json'),
        (json) => {
          return {
            name: packageJson.name,
            ...json,
          };
        }
      );
    } else {
      writeJson(
        host,
        joinPathFragments(options.appProjectRoot, 'package.json'),
        packageJson
      );
    }
  }
}

function createRspackBuildTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/rspack:rspack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      outputPath: options.isUsingTsSolutionConfig
        ? joinPathFragments(options.appProjectRoot, 'dist')
        : joinPathFragments(
            'dist',
            options.appProjectRoot !== '.'
              ? options.appProjectRoot
              : options.projectName
          ),
      index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
      baseHref: '/',
      main: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, `src/main.tsx`)
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [
        joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
        joinPathFragments(options.appProjectRoot, 'src/assets'),
      ],
      rspackConfig: joinPathFragments(
        options.appProjectRoot,
        'rspack.config.js'
      ),
      styles:
        options.styledModule || !options.hasStyles
          ? []
          : [
              joinPathFragments(
                options.appProjectRoot,
                `src/styles.${
                  options.style === 'tailwind' ? 'css' : options.style
                }`
              ),
            ],
      scripts: [],
      configurations: {
        development: {
          mode: 'development',
        },
        production: {
          mode: 'production',
          optimization: true,
          sourceMap: false,
          outputHashing: 'all',
          namedChunks: false,
          extractLicenses: true,
          vendorChunk: false,
        },
      },
    },
  };
}

function createRspackServeTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/rspack:dev-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.projectName}:build`,
      hmr: true,
    },
    configurations: {
      development: {
        buildTarget: `${options.projectName}:build:development`,
      },
      production: {
        buildTarget: `${options.projectName}:build:production`,
        hmr: false,
      },
    },
  };
}

function createBuildTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nx/webpack:webpack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      compiler: options.compiler ?? 'babel',
      outputPath: options.isUsingTsSolutionConfig
        ? joinPathFragments(options.appProjectRoot, 'dist')
        : joinPathFragments(
            'dist',
            options.appProjectRoot !== '.'
              ? options.appProjectRoot
              : options.projectName
          ),
      index: joinPathFragments(options.appProjectRoot, 'src/index.html'),
      baseHref: '/',
      main: joinPathFragments(
        options.appProjectRoot,
        maybeJs(options, `src/main.tsx`)
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [
        joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
        joinPathFragments(options.appProjectRoot, 'src/assets'),
      ],
      styles:
        options.styledModule || !options.hasStyles
          ? []
          : [
              joinPathFragments(
                options.appProjectRoot,
                `src/styles.${
                  options.style === 'tailwind' ? 'css' : options.style
                }`
              ),
            ],
      scripts: [],
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
    },
    configurations: {
      development: {
        extractLicenses: false,
        optimization: false,
        sourceMap: true,
        vendorChunk: true,
      },
      production: {
        fileReplacements: [
          {
            replace: joinPathFragments(
              options.appProjectRoot,
              maybeJs(options, `src/environments/environment.ts`)
            ),
            with: joinPathFragments(
              options.appProjectRoot,
              maybeJs(options, `src/environments/environment.prod.ts`)
            ),
          },
        ],
        optimization: true,
        outputHashing: 'all',
        sourceMap: false,
        namedChunks: false,
        extractLicenses: true,
        vendorChunk: false,
      },
    },
  };
}

function createServeTarget(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: '@nx/webpack:dev-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.projectName}:build`,
      hmr: true,
    },
    configurations: {
      development: {
        buildTarget: `${options.projectName}:build:development`,
      },
      production: {
        buildTarget: `${options.projectName}:build:production`,
        hmr: false,
      },
    },
  };
}

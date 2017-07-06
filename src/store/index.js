/* eslint-disable no-param-reassign */

import Vue from 'vue';
import Vuex from 'vuex';

import api from '../api';
import apiStatus from '../api/status';

import auth from './auth';
import tasks from './tasks';

Vue.use(Vuex);

const store = new Vuex.Store({
    modules: { auth, tasks },

    state: {
        status: null,
        config: null,
        error: null,
        version: null,
    },

    mutations: {
        setStatus(state, { status, config, version }) {
            state.status = status;
            state.config = config;
            state.version = version;
        },

        setError(state, error) {
            if (state.error === null) {
                state.error = error;
            }
        },
    },

    actions: {
        fetchStatus: ({ state, commit, dispatch }, force) => {
            if (!force && state.status !== null) {
                return state.status;
            }

            return api.fetchStatus().then(
                (result) => {
                    if (!(result instanceof Object)) {
                        commit('setError', {
                            title: Vue.i18n.translate('ui.app.apiError'),
                            type: 'about:blank',
                            status: 500,
                            detail: result,
                        });

                        throw result;
                    }

                    commit('setStatus', result);

                    if (result.username) {
                        commit('auth/setLogin', result.username);
                    } else {
                        commit('auth/setLogout');
                        commit('tasks/setStatus', null);
                    }

                    if (result.status === apiStatus.OK && result.task) {
                        dispatch('tasks/reload').catch(() => {});
                    } else if (result.update === true && result.username) {
                        dispatch('tasks/execute', { type: 'self-update' }).then(
                            () => { window.location.reload(true); },
                            () => { window.location.reload(true); },
                        );
                    }

                    return result;
                },
            );
        },

        configure: ({ state }, props) => {
            const config = props || state.config;

            return new Promise((resolve, reject) => {
                if (!config.github_oauth_token) {
                    resolve();
                    return;
                }

                api.setGithubToken(config.github_oauth_token).then(
                    () => {
                        delete config.github_oauth_token;
                        resolve();
                    },
                    () => {
                        reject({
                            key: 'github_oauth_token',
                            error: 'Unknown Error',
                        });
                    },
                );
            }).then(() => api.configure(config).catch(
                (response) => {
                    throw response.body;
                },
            ));
        },

        install: ({ dispatch }, version) => {
            const task = {
                type: 'install',
                version,
            };

            return dispatch('tasks/execute', task, { root: true }).then(
                () => dispatch('fetchStatus', true, { root: true }),
            );
        },
    },
});

export default store;

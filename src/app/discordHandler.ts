import { Client } from 'discord-rpc';

import { capitalize, ElectronWindow } from '../common';
import { displayNameToIcon, languages } from './languages';

import Timeout = NodeJS.Timeout;
const startTimestamp = Date.now();
class DiscordHandler {
    private client: Client;
    private readonly window: ElectronWindow;
    private discordTimer: Timeout;

    constructor(window: ElectronWindow) {
        this.window = window;
        this.client = null;
        this.connectDiscord();
    }

    connectDiscord() {
        if (!this.client) this.client = new Client({ transport: 'ipc' });
        this.client.login({ clientId: '498635999274991626' }).catch((error: string) => {
            // console.error(error);
            console.debug('[RPC] Error: Make sure Discord client is available and you are connected to the Internet');
            delete this.client;
        });
        this.client.on('ready', () => {
            console.debug('Discord Client ready');
            this.setPlayingDiscord();
            this.discordTimer = setInterval(() => {
                this.setPlayingDiscord().catch((e: string) => console.error(`Failed to update Discord status. ${e}`));
            }, 10e3);
        });
    }

    disconnectDiscord() {
        this.client.clearActivity();
        clearInterval(this.discordTimer);
        this.client.destroy();
        delete this.client;
    }

    async setPlayingDiscord() {
        let url: string = this.window.getReplUrl();
        let spliturl: string[] = url.split('/');
        if (spliturl[0] === 'repls' || spliturl[0] === '~') {
            this.client.setActivity({
                details: 'Browsing Repls',
                state: `replit.com/${spliturl[0]}`,
                startTimestamp,
                largeImageKey: 'logo-bg',
                largeImageText: 'Replit',
                instance: false
            });
        } else if (spliturl[0] === 'talk') {
            this.setTalkBoard(spliturl, this.window).then(
                (res) => {
                    this.client
                        .setActivity({
                            state: `${res.viewing}`,
                            details: `In Repl Talk ${res.talkBoard}`,
                            startTimestamp,
                            largeImageKey: 'talk-bg',
                            largeImageText: 'Repl Talk',
                            smallImageKey: 'logo-bg',
                            smallImageText: 'Replit',
                            instance: false
                        })
                        .catch((reason) => {
                            console.error(`error@talk board ${reason}`);
                        });
                },
                (reason: string) => {
                    console.error(`Set Talk board Failed ${reason}`);
                }
            );
        } else if (spliturl[0][0] === '@' && spliturl[1] !== undefined) {
            this.setEditing(this.window, spliturl).then(
                (res) => {
                    this.client
                        .setActivity({
                            details: `Editing: ${res.fileName}`,
                            state: `Repl: ${res.state}`,
                            startTimestamp,
                            smallImageKey: 'logo-bg',
                            smallImageText: 'Replit',
                            largeImageKey: res.largeImageKey,
                            largeImageText: res.largeImageText,
                            instance: false
                        })
                        .catch((reason) => {
                            console.error(`error@editing ${reason}`);
                        });
                },
                (reason: string) => {
                    console.error(`Set editing failed ${reason}`);
                }
            );
        } else if (spliturl[0] === 'talk') {
            this.client
                .setActivity({
                    details: 'In Repl Talk',
                    state: `replit.com/${url}`,
                    startTimestamp,
                    largeImageKey: 'talk-bg',
                    largeImageText: 'Repl Talk',
                    smallImageKey: 'logo-bg',
                    smallImageText: 'Replit',
                    instance: false
                })
                .catch((reason) => {
                    console.error(`error@talk ${reason}`);
                });
        } else if (spliturl[0][0] === '@') {
            this.client
                .setActivity({
                    details: `Looking at ${spliturl[0]}'s profile`,
                    state: `replit.com/${url}`,
                    startTimestamp,
                    largeImageKey: 'logo-bg',
                    largeImageText: 'Replit',
                    instance: false
                })
                .catch((reason) => {
                    console.debug(`error@profile ${reason}`);
                });
        } else if (spliturl[0] === 'account') {
            this.client
                .setActivity({
                    details: 'Changing account settings',
                    state: `replit.com/${url}`,
                    startTimestamp,
                    largeImageKey: 'logo-bg',
                    largeImageText: 'Replit',
                    instance: false
                })
                .catch((reason) => {
                    console.debug(`error@account ${reason}`);
                });
        } else {
            this.client
                .setActivity({
                    details: 'On Replit',
                    state: `replit.com/${url}`,
                    startTimestamp,
                    largeImageKey: 'logo-bg',
                    largeImageText: 'Replit',
                    instance: false
                })
                .catch((reason) => {
                    console.error(`error@main ${reason}`);
                });
        }
    }

    async setTalkBoard(spliturl: string[], windowObj: ElectronWindow): Promise<{ viewing: string; talkBoard: string }> {
        let viewing: string = 'Viewing ';
        if (spliturl[3] !== undefined) {
            viewing += await windowObj.webContents.executeJavaScript(
                "document.getElementsByClassName('board-post-detail-title')[0].textContent"
            ); // gets the repl talk post name
        } else {
            viewing = `Viewing ${spliturl[2] !== undefined ? spliturl[2] : spliturl[1]}`;
        }
        return { viewing: viewing, talkBoard: capitalize(spliturl[1]) };
    }

    async setEditing(
        windowObj: ElectronWindow,
        spliturl: string[]
    ): Promise<{
        fileName: string;
        largeImageKey: string;
        largeImageText: string;
        state: string;
    }> {
        let {
            personal,
            activeFile,
            largeImageText,
            replType
        }: {
            [key: string]: string;
        } = await windowObj.webContents.executeJavaScript(
            `
            (
                () => {
                    try {
                        return window.store && document.querySelector('img.jsx-2652062152') ? {
                            "personal": 'true',
                            "activeFile": window.store.getState().activeFile,
                            "largeImageText": window.store.getState().plugins.fs.state.repl.language,
                            "replType": document.querySelector('img.jsx-2652062152').title,
                        } : {
                            "personal": 'false',
                            "activeFile": window.location.pathname,
                            "largeImageText": 'Viewing Another Users Repl.',
                            "replType": document.querySelector('.jsx-3298514671.heading').innerText,
                        };
                    } catch (err) {
                        return {
                            "personal": 'unknown',
                            "activeFile": 'unknown',
                            "largeImageText": 'unknown',
                            "replType": 'text',
                        };
                    }
                }
            )();
            `
        );
        if (personal == 'true') {
            for (const [key, value] of Object.entries(languages)) {
                if (value.test(activeFile) && displayNameToIcon[key]) {
                    replType = key;
                    break;
                }
            }
        }
        if (activeFile == undefined) activeFile = 'unknown';
        const url = spliturl[1].replace(/(#)\w+.*/, '');
        return {
            fileName: activeFile,
            largeImageKey: displayNameToIcon[replType],
            largeImageText: largeImageText,
            state: url
        };
    }
}

export { DiscordHandler };

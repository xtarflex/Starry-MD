/*
 * Router Module
 * Handles command restriction to specific groups.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import utils from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_DB = path.join(__dirname, '../database/command-router.json');

let routerConfig = null;

async function loadRouter() {
    try {
        routerConfig = await fs.readJSON(ROUTER_DB);
    } catch (err) {
        // If file doesn't exist or is invalid, create default
        routerConfig = { routes: {}, categories: {} };
        await fs.writeJSON(ROUTER_DB, routerConfig, { spaces: 2 });
    }
    return routerConfig;
}

/**
 * Checks if a command is allowed in the current chat.
 * @param {string} cmd - The command name.
 * @param {string} from - The JID of the current chat.
 * @returns {object} { allowed: boolean, redirect: object | null }
 */
async function checkRoute(cmd, from) {
    if (!routerConfig) await loadRouter();

    // 1. Check direct command routes
    if (routerConfig.routes[cmd]) {
        const route = routerConfig.routes[cmd];

        if (route.allowedGroups && route.allowedGroups.length > 0) {
            if (!route.allowedGroups.includes(from)) {
                return {
                    allowed: false,
                    redirect: {
                        groupName: route.groupName,
                        inviteLink: route.inviteLink
                    }
                };
            }
        }
    }

    // 2. Check category routes
    let matchedCategories = [];
    for (const key in routerConfig.categories) {
        const category = routerConfig.categories[key];
        if (category.commands && category.commands.includes(cmd)) {
            matchedCategories.push(category);
        }
    }

    if (matchedCategories.length > 0) {
        let isAllowed = false;
        let primaryRedirect = null;

        for (const category of matchedCategories) {
            // If a category has no restrictions (empty allowedGroups), it permits the command globally
            if (!category.allowedGroups || category.allowedGroups.length === 0) {
                isAllowed = true;
                break;
            }
            // Check if current group is allowed
            if (category.allowedGroups.includes(from)) {
                isAllowed = true;
                break;
            }

            // Capture the first restriction details for redirect info
            if (!primaryRedirect) {
                primaryRedirect = {
                    groupName: category.name || category.groupName,
                    inviteLink: category.inviteLink
                };
            }
        }

        if (!isAllowed) {
            return {
                allowed: false,
                redirect: primaryRedirect
            };
        }
    }

    // Default: Allowed
    return { allowed: true };
}

/**
 * Checks if a group is recognized by the router configuration.
 * @param {string} jid 
 * @returns {boolean}
 */
function isKnownGroup(jid) {
    if (!routerConfig) return false;

    // Check categories
    for (const key in routerConfig.categories) {
        if (routerConfig.categories[key].allowedGroups?.includes(jid)) {
            return true;
        }
    }

    // Check routes
    for (const key in routerConfig.routes) {
        if (routerConfig.routes[key].allowedGroups?.includes(jid)) {
            return true;
        }
    }

    return false;
}

export default {
    loadRouter,
    checkRoute,
    isKnownGroup
};

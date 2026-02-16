import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import utils from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamically loads command modules from the 'commands' directory.
 * @returns {Promise<Map<string, Object>>} A map of command names/aliases to command objects.
 */
async function loadCommands() {
    const commands = new Map();
    const commandsDir = path.join(__dirname, 'commands');

    if (!fs.existsSync(commandsDir)) {
        utils.log('WARN', 'Commands directory not found. Creating it...');
        fs.mkdirSync(commandsDir);
        return commands;
    }

    const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

    for (const file of files) {
        try {
            const commandPath = path.join(commandsDir, file);
            // Convert file path to URL for ESM import
            const fileUrl = pathToFileURL(commandPath).toString();

            // ESM import (dynamic)
            const module = await import(fileUrl);
            const exported = module.default || module;

            // Support both single command objects and arrays of commands
            const commandList = Array.isArray(exported) ? exported : [exported];

            for (const command of commandList) {
                if (command.name && command.execute) {
                    // Register main name
                    commands.set(command.name.toLowerCase(), command);

                    // Register aliases
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            commands.set(alias.toLowerCase(), command);
                        }
                    }
                    utils.log('SYSTEM', `Loaded command: ${command.name}`);
                } else {
                    utils.log('WARN', `Skipping invalid command in file: ${file} (missing name or execute)`);
                }
            }
        } catch (err) {
            utils.log('ERROR', `Failed to load command ${file}: ${err.message}`);
        }
    }

    utils.log('SYSTEM', `Total commands loaded: ${commands.size} (including aliases)`);
    return commands;
}

export { loadCommands };

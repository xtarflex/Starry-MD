import { handleTrends } from '../../services/info-zone.js';

/**
 * @type {import('../../types').Command}
 */
export const name = "trends";
export const description = "Fetch latest Google search trends";
export const aliases = ["trend"];
export const category = "info";
export async function execute(msg, sock, args, botState) {
    const argsStr = args.join(' ');
    return handleTrends(msg, sock, botState, argsStr);
}

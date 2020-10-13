/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MarkdownEngine } from '../markdownEngine';
import { TableOfContentsProvider } from '../tableOfContentsProvider';
import { flatten } from '../util/arrays';

export default class MarkdownSmartSelect implements vscode.SelectionRangeProvider {

	constructor(
		private readonly engine: MarkdownEngine
	) { }
	public async provideSelectionRanges(document: vscode.TextDocument, positions: vscode.Position[], _token: vscode.CancellationToken): Promise<vscode.SelectionRange[]> {
		let ranges = await Promise.all([
			await this.getHeaderSelectionRanges(document, positions),
			await this.getBlockSelectionRanges(document, positions)
			]);
		return flatten(ranges);
	}

	private async getBlockSelectionRanges(document: vscode.TextDocument, positions: vscode.Position[]): Promise<vscode.SelectionRange[]> {
		let position = positions[0];
		const tokens = await this.engine.parse(document);
		let nearbyTokens = tokens.filter(token => token.type !== 'heading_open' && token.map && (token.map[0] <= position.line && token.map[1] >= position.line));
		let firstToken = nearbyTokens.pop();
		if (firstToken) {
			let parentRange = new vscode.SelectionRange(new vscode.Range(new vscode.Position(firstToken.map[0], 0), new vscode.Position(firstToken.map[1], 0)));
			let ranges = nearbyTokens.map(token => {
				let start = token.map[0];
				let end = token.type === 'bullet_list_open' ? token.map[1] - 1 : token.map[1];
				let startPos = new vscode.Position(start, 0);
				let endPos = new vscode.Position(end, 0);
				if (parentRange.range.contains(new vscode.Range(startPos, endPos))) {
					return new vscode.SelectionRange(new vscode.Range(startPos, endPos), parentRange);
				} else {
					return new vscode.SelectionRange(new vscode.Range(startPos, endPos));
				}
			});
			return [ranges[0]];
		}
		return [];
	}

	private async getHeaderSelectionRanges(document: vscode.TextDocument, positions: vscode.Position[]): Promise<vscode.SelectionRange[]> {
		let position = positions[0];
		const tocProvider = new TableOfContentsProvider(this.engine, document);
		const toc = await tocProvider.getToc();
		let nearbyEntries = toc.filter(entry => entry.line === position.line);
		return [nearbyEntries.map(entry => {
			let endLine = entry.location.range.end.line;
			if (document.lineAt(endLine).isEmptyOrWhitespace && endLine >= entry.line + 1) {
				endLine = endLine - 1;
			}
			let startPos = entry.location.range.start;
			let endPos = new vscode.Position(endLine, entry.location.range.end.character);
			return new vscode.SelectionRange(new vscode.Range(startPos, endPos));
		})][0];
	}
}

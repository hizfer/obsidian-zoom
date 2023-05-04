import { Plugin } from "obsidian";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { Feature } from "./Feature";
import { getEditorViewFromEditorState } from "./utils/getEditorViewFromEditorState";

import { DetectVisibleContentBoundariesViolation } from "../logic/DetectVisibleContentBoundariesViolation";
import { LoggerService } from "../services/LoggerService";

export interface CalculateHiddenContentRanges {
  calculateHiddenContentRanges(
    state: EditorState
  ): { from: number; to: number }[] | null;
}

export interface ZoomOut {
  zoomOut(view: EditorView): void;
}

export class ResetZoomWhenVisibleContentBoundariesViolatedFeature
  implements Feature
{
  private detectVisibleContentBoundariesViolation =
    new DetectVisibleContentBoundariesViolation(
      this.calculateHiddenContentRanges,
      {
        visibleContentBoundariesViolated: (state) =>
          this.visibleContentBoundariesViolated(state),
      }
    );

  constructor(
    private plugin: Plugin,
    private logger: LoggerService,
    private calculateHiddenContentRanges: CalculateHiddenContentRanges,
    private zoomOut: ZoomOut
  ) {}

  async load() {
    this.plugin.registerEditorExtension(
      this.detectVisibleContentBoundariesViolation.getExtension()
    );
  }

  async unload() {}

  private visibleContentBoundariesViolated(state: EditorState) {
    const l = this.logger.bind(
      "ResetZoomWhenVisibleContentBoundariesViolatedFeature:visibleContentBoundariesViolated"
    );
    l("visible content boundaries violated, zooming out");
    this.zoomOut.zoomOut(getEditorViewFromEditorState(state));
  }
}

export function ScrollPreservingSheetMixin(Base) {
  return class ScrollPreservingSheet extends Base {
    async _onRender(context, options) {
      await super._onRender(context, options);
      this._restoreScrollPosition();
    }

    _onChangeForm(formConfig, event) {
      this._rememberScrollPosition();
      return super._onChangeForm(formConfig, event);
    }

    _getScrollElement() {
      if (!this.element) return null;

      const selectors = this.constructor.PARTS?.sheet?.scrollable ?? [];
      for (const selector of selectors) {
        if (!selector) continue;
        if (this.element.matches?.(selector)) return this.element;
        const match = this.element.querySelector(selector);
        if (match) return match;
      }

      return this.element;
    }

    _rememberScrollPosition(renders = 3) {
      const scrollEl = this._getScrollElement();
      if (!scrollEl) {
        this._pendingScrollPosition = null;
        return;
      }

      this._pendingScrollPosition = {
        top: scrollEl.scrollTop ?? 0,
        left: scrollEl.scrollLeft ?? 0,
        renders: Math.max(Number(renders) || 0, 1)
      };
    }

    _restoreScrollPosition() {
      const pending = this._pendingScrollPosition;
      if (!pending?.renders) return;

      const scrollEl = this._getScrollElement();
      if (!scrollEl) return;

      requestAnimationFrame(() => {
        scrollEl.scrollTop = pending.top ?? 0;
        scrollEl.scrollLeft = pending.left ?? 0;
        pending.renders = Math.max((pending.renders ?? 1) - 1, 0);
        if (!pending.renders) {
          this._pendingScrollPosition = null;
        }
      });
    }
  };
}

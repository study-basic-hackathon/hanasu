import "@testing-library/jest-dom/vitest";

// jsdom does not implement the modal methods yet. The components under test
// only rely on the standard `open` state those methods update.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value() {
      this.open = true;
    },
  },
  close: {
    configurable: true,
    value() {
      this.open = false;
    },
  },
});

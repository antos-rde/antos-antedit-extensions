(function() {
  // import the CodePad application module
  var App, TerminalWrapper, html;

  App = this.OS.application.CodePad;

  html = `<div data-id="codepad-terminal-container"></div>`;

  TerminalWrapper = class TerminalWrapper extends App.BaseExtension {
    constructor(parent) {
      super(parent.app);
      this.parent = parent;
      this.newTerminal();
    }

    newTerminal() {
      var scheme;
      if (this.description) {
        return this.description.domel.selected = true;
      }
      // create html element
      scheme = $.parseHTML(html)[0];
      this.description = {
        text: __("Terminal"),
        iconclass: "fa fa-terminal",
        container: scheme
      };
      this.app.showBottomBar(true);
      this.app.bottombar.addTab(this.description, true);
      this.term = new Terminal({
        cursorBlink: true
      });
      this.fitAddon = new FitAddon.FitAddon();
      this.term.loadAddon(this.fitAddon);
      this.term.setOption('fontSize', '12');
      this.term.open(scheme);
      this.sub = void 0;
      this.term.onKey((d) => {
        if (!this.sub) {
          return;
        }
        return this.sub.send(Antunnel.Msg.DATA, new TextEncoder("utf-8").encode(d.key));
      });
      scheme.contextmenuHandle = (e, m) => {
        m.items = [
          {
            text: "__(Copy)",
            id: "copy"
          },
          {
            text: "__(Paste)",
            id: "paste"
          }
        ];
        m.onmenuselect = (e) => {
          if (!e) {
            return;
          }
          return this.mctxHandle(e.data.item.data);
        };
        return m.show(e);
      };
      this.resizeContent();
      this.resizefn = (e) => {
        return this.resizeContent();
      };
      this.app.on("resize", this.resizefn);
      $(scheme).on("focus", (e) => {
        return this.term.focus();
      });
      return this.openSession();
    }

    resizeContent(e) {
      var arr, ncol, nrow;
      if ($(this.description.container).is(":hidden")) {
        return;
      }
      this.fitAddon.fit();
      ncol = this.term.cols;
      nrow = this.term.rows;
      if (!this.sub) {
        return;
      }
      try {
        arr = new Uint8Array(8);
        arr.set(Antunnel.Msg.bytes_of(ncol), 0);
        arr.set(Antunnel.Msg.bytes_of(nrow), 4);
        return this.sub.send(Antunnel.Msg.CTRL, arr);
      } catch (error) {
        e = error;
      }
    }

    mctxHandle(data) {
      var cb, text;
      switch (data.id) {
        case "paste":
          cb = (text) => {
            if (!(text && text !== "")) {
              return;
            }
            text = text.replace(/\r/g, "").replace(/\n/g, "\r");
            if (this.sub) {
              this.sub.send(Antunnel.Msg.DATA, new TextEncoder("utf-8").encode(text));
            }
            return this.term.focus();
          };
          return this.app._api.getClipboard().then((text) => {
            return cb(text);
          }).catch((e) => {
            this.error(__("Unable to paste"), e);
            //ask for user to enter the text manually
            return this.app.openDialog("TextDialog", {
              title: "Paste text"
            }).then((text) => {
              return cb(text);
            }).catch((err) => {
              return this.error(err.toString(), err);
            });
          });
        case "copy":
          text = this.term.getSelection();
          if (!(text && text !== "")) {
            return;
          }
          return this.app._api.setClipboard(text);
      }
    }

    openSession() {
      this.term.clear();
      this.term.focus();
      this.sub = new Antunnel.Subscriber("vterm");
      this.sub.onopen = () => {
        console.log("Subscribed");
        this.resizeContent(($(this.mterm)).width(), ($(this.mterm)).height());
        return this.term.focus();
      };
      this.sub.onerror = (e) => {
        this.error(__("Unable to connect to: vterm"), e);
        this.sub = void 0;
        return this.cleanup();
      };
      this.sub.onmessage = (e) => {
        if (this.term && e.data) {
          return this.term.write(new TextDecoder("utf-8").decode(e.data));
        }
      };
      this.sub.onclose = () => {
        this.sub = void 0;
        this.notify(__("Terminal connection closed"));
        return this.cleanup();
      };
      return Antunnel.tunnel.subscribe(this.sub);
    }

    cleanup() {
      if (this.resizefn && this.app.observable) {
        this.app.off("resize", this.resizefn);
      }
      this.app.bottombar.selectedIndex = 0;
      if (this.sub) {
        this.sub.close();
      }
      this.sub = void 0;
      if (!this.description) {
        return;
      }
      this.app.bottombar.removeTab(this.description.domel);
      this.description = void 0;
      return this.parent.remove(this);
    }

  };

  // define the extension
  App.extensions.CodePadTerminal = class CodePadTerminal extends App.BaseExtension {
    constructor(app) {
      super(app);
      this.terminals = [];
    }

    dependencies() {
      return ["pkg://xTerm/main.js", "pkg://xTerm/main.css", "pkg://Antunnel/main.js"];
    }

    open() {
      if (!(window.Antunnel && Antunnel.tunnel)) {
        return this.notify(__("Antunnel service is not available"));
      }
      if (!Terminal) {
        return this.notify(__("xTerm library is not available"));
      }
      return this.terminals.push(new TerminalWrapper(this));
    }

    remove(instance) {
      var index;
      index = this.terminals.indexOf(instance);
      if (!(index > -1)) {
        return;
      }
      return this.terminals.splice(index, 1);
    }

    cleanup() {
      var i, len, ref, results, v;
      ref = this.terminals;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        v = ref[i];
        results.push(v.cleanup());
      }
      return results;
    }

  };

}).call(this);


(function() {
    // import the CodePad application module
    const App = this.OS.application.Antedit;
    
    // define the extension
    App.extensions.AnteditGitGraph = class AnteditGitGraph extends App.EditorBaseExtension {
        

        constructor(app) {
          super("AnteditGitGraph",app);
          this.graph = undefined;
          this.desc = undefined;
        }
        
        open() {
          if(!this.app.currdir)
          {
            return;
          }
          if(!OS.API.LibGitGraph)
          {
            return this.error("GitGraph package is not installed, please install it first");
          }
          this.app.showBottomBar(true);
          if(!this.graph)
          {
            //insert element to bottom pannel
            const div = $("<div />")[0];
            this.desc = {
              text: __("Git graph"),
              iconclass: "bi bi-git",
              container: div,
              closable: true
            };
            this.app.bottombar.addTab(this.desc, true);
            this.graph = new OS.API.LibGitGraph({
              target: div,
              popup_height: 150
            });
            this.graph.on_open_diff = (files) => {
              this.app.openDiff(files);
            };
          }
          else
          {
            this.desc.domel.selected = true;
          }
          this.graph.base_dir = this.app.currdir.asFileHandle();

        }
        
        cleanup() {
          this.graph = undefined;
          if(this.desc)
          {
            this.app.bottombar.removeTab(this.desc.domel);
          }
        }
    
    };
    App.extensions.AnteditGitGraph.dependencies = [
      "pkg://GitGraph/libgitgraph.js",
      "pkg://GitGraph/main.css"
    ];
}).call(this);
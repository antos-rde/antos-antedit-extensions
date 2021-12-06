# import the Antedit application module
App = this.OS.application.Antedit

html = """
<div></div>
"""

class TerminalWrapper extends App.EditorBaseExtension
    constructor: (parent) ->
        super "TerminalWrapper", parent.app
        @parent = parent
        this.newTerminal()
        
    newTerminal: () ->
        return @description.domel.selected = true if @description
        # create html element
        scheme = $.parseHTML(html)[0]
        @description = {
            text: __("Terminal"),
            iconclass: "fa fa-terminal",
            container: scheme
        }
        @app.showBottomBar(true)
        @app.bottombar.addTab(@description, true)
        @term = new Terminal { cursorBlink: true }
        @fitAddon = new FitAddon.FitAddon()
        @term.loadAddon(@fitAddon)
        @term.setOption('fontSize', '12')
        @term.open scheme
        @sub = undefined
        @term.onKey (d) =>
            return unless @sub
            @sub.send Antunnel.Msg.DATA, new TextEncoder("utf-8").encode(d.key)
        
        scheme.contextmenuHandle = (e, m) =>
            m.items = [
                { text: "__(Copy)", id: "copy" },
                { text: "__(Paste)", id: "paste"}
            ]
            m.onmenuselect = (e) =>
                return unless e
                @mctxHandle e.data.item.data
            m.show e
            
        @resizeContent()
        @resizefn = (e) =>
            @resizeContent()
        @app.on "resize", @resizefn
        $(scheme).on "focus", (e) => @term.focus()
        @openSession()
    
    resizeContent: (e) ->
        return if $(@description.container).is(":hidden")
        @fitAddon.fit()
        ncol = @term.cols
        nrow = @term.rows
        return unless @sub
        try
            arr = new Uint8Array(8)
            arr.set Antunnel.Msg.bytes_of(ncol, 4), 0
            arr.set Antunnel.Msg.bytes_of(nrow, 4), 4
            @sub.send Antunnel.Msg.CTRL, arr
        catch e
    
    mctxHandle: (data) ->
        switch data.id
            when "paste"
                cb = (text) =>
                    return unless text and text isnt ""
                    text = text
                            .replace /\r/g, ""
                            .replace /\n/g, "\r"
                    @sub.send Antunnel.Msg.DATA, new TextEncoder("utf-8").encode(text) if @sub
                    @term.focus()
                    
                @app._api.getClipboard()
                    .then (text) =>
                        cb(text)
                    .catch (e) =>
                        @error __("Unable to paste"), e
                        #ask for user to enter the text manually
                        @app.openDialog("TextDialog", { title: "Paste text"})
                            .then (text) =>
                                cb(text)
                            .catch (err) => @error err.toString(), err
            when "copy"
                text = @term.getSelection()
                return unless text and text isnt ""
                @app._api.setClipboard text
            else

    openSession: () ->
        @term.clear()
        @term.focus()
        @sub = new Antunnel.Subscriber("vterm")
        @sub.onopen = () =>
            @resizeContent()
            @term.focus()
        
        @sub.onerror = (e) =>
            @error __("Unable to connect to: vterm"), e
            # @sub = undefined
            @cleanup()

        @sub.onmessage =  (e) =>
            @term.write(new TextDecoder("utf-8").decode(e.data)) if @term and e.data
        
        @sub.onclose = () =>
            @sub = undefined
            @notify __("Terminal connection closed")
            @cleanup()
        
        Antunnel.tunnel.subscribe @sub
    
    cleanup: () ->
        if(@resizefn and @app.observable)
            @app.off "resize", @resizefn
        @app.bottombar.selectedIndex = 0
        @sub.close() if @sub
        @sub = undefined
        return unless @description
        @app.bottombar.removeTab(@description.domel)
        @description = undefined
        @parent.remove(this)

# define the extension
class App.extensions.AnteditTerminal extends App.EditorBaseExtension
    constructor: (app) ->
        super "AnteditTerminal", app
        @terminals = []

    open: () ->
        return @notify __("Antunnel service is not available") unless window.Antunnel
        return @notify __("xTerm library is not available") unless Terminal
        if not Antunnel.tunnel
            @app._gui.pushService("Antunnel/AntunnelService")
            .then (d) =>
                return unless @app.systemsetting.system.tunnel_uri
                Antunnel.init(@app.systemsetting.system.tunnel_uri).then (t) =>
                    @notify __("Tunnel now connected to the server at: {0}", @app.systemsetting.system.tunnel_uri)
                    @terminals.push(new TerminalWrapper(this))
                .catch (e) =>
                    Antunnel.tunnel.close() if Antunnel.tunnel
                    @error __("Unable to connect to the tunnel: {0}", e.toString()), e
            .catch (e) =>
                @error __("Unable to run Antunnel service: {0}",e.toString()), e
                @quit()
        else
            @terminals.push(new TerminalWrapper(this))
    
    remove: (instance) ->
        index = @terminals.indexOf(instance)
        return unless index > -1
        @terminals.splice(index, 1)
    
    cleanup: () ->
        v.cleanup() for v in @terminals

App.extensions.AnteditTerminal.dependencies =
[
    "pkg://xTerm/main.js",
    "pkg://xTerm/main.css",
    "pkg://Antunnel/main.js"
]
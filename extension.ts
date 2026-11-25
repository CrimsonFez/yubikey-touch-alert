import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import { MessageDialogContent } from 'resource:///org/gnome/shell/ui/dialog.js';
import { ModalDialog } from 'resource:///org/gnome/shell/ui/modalDialog.js';

export default class YubikeyTouchPopup extends Extension {
    private _cancellable: Gio.Cancellable | null = null;
    private _connection: Gio.SocketConnection | null = null;
    private _dialog: ModalDialog | null = null;

    enable(): void {
        this._cancellable = new Gio.Cancellable();
        this._connect();
    }

    private async _connect(): Promise<void> {
        const cancellable = this._cancellable!;
        const path = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'yubikey-touch-detector.socket']);

        try {
            const client = new Gio.SocketClient();
            const address = Gio.UnixSocketAddress.new(path);
            this._connection = await new Promise<Gio.SocketConnection>((resolve, reject) => {
                client.connect_async(address, cancellable, (_c, res) => {
                    try {
                        resolve(client.connect_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            const input = this._connection.get_input_stream();
            const decoder = new TextDecoder();

            while (!cancellable.is_cancelled()) {
                const bytes: GLib.Bytes = await new Promise((resolve, reject) => {
                    input.read_bytes_async(5, GLib.PRIORITY_DEFAULT, cancellable, (s, res) => {
                        try {
                            resolve(s!.read_bytes_finish(res));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });

                if (bytes.get_size() === 0)
                    break; // EOF: detector went away

                this._onMessage(decoder.decode(bytes.toArray()));
            }
        } catch (e) {
            if (!(e as GLib.Error).matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error('yubikey socket error', e);
        }
    }

    private _onMessage(msg: string): void {
        console.log(`touch event: ${msg}`);
        if (msg.endsWith('_1')) {
            this.show()
        } else if (msg.endsWith('_0')) {
            this.hide()
        }
    }

    private show() {
        if (this._dialog) return

        const dialog = new ModalDialog({
            destroyOnClose: true,
        })

        dialog.contentLayout.add_child(new MessageDialogContent({
            title: "Touch your YubiKey",
            description: "Waiting for touch..."
        }))

        dialog.setButtons([{
            label: "Dismiss",
            action: () => {
                dialog.destroy();
            },
            key: Clutter.KEY_Escape,
        }])

        // add destroy callback
        dialog.connect('destroy', () => {
            if (this._dialog === dialog) {
                this._dialog = null
            }
        });

        this._dialog = dialog
        if (!dialog.open()) {
            dialog.destroy()
        }
    }

    private hide(){
        this._dialog?.close()
    }

    disable(): void {
        this._cancellable?.cancel()
        this._cancellable = null
        this._connection?.close(null)
        this._connection = null
        this._dialog?.destroy()
        this._dialog = null
    }
}

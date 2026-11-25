{
  description = "GNOME Shell extension dev shell";

  inputs.nixpkgs.url = "nixpkgs";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            gnome-shell      # gnome-extensions CLI + gnome-shell for nested sessions
            mutter           # nested compositor support
            gjs              # run/lint GJS scripts
            glib             # glib-compile-schemas
            gettext          # translations (xgettext, msgfmt)
            zip
            dbus             # dbus-run-session
            libadwaita       # typelibs for prefs.js
            gtk4

            # optional: TypeScript workflow
            nodejs
            typescript
          ];

          shellHook = ''
            export GSETTINGS_SCHEMA_DIR="$PWD/schemas"
          '';
        };
      });
    };
}

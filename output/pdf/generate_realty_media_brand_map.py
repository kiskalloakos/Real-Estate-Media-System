"""Compatibility entry point for the Realty Media brand toolkit generator."""

from generate_realty_media_brand_toolkit import brand_map, register_fonts, OUT


if __name__ == "__main__":
    register_fonts()
    brand_map(OUT / "realty-media-brand-map.pdf")
    print(OUT / "realty-media-brand-map.pdf")

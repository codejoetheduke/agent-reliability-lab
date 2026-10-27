"""PyInstaller entry; application logic remains in the installed backend package."""

from multiprocessing import freeze_support

from reliability_lab.runtime import main

if __name__ == "__main__":
    freeze_support()
    main()

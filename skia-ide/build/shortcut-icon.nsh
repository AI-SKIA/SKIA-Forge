!macro customInstall
  DeleteINIStr "$DESKTOP\SKIA FORGE.lnk" "" ""
  CreateShortCut "$DESKTOP\SKIA FORGE.lnk" "$INSTDIR\SKIA-FORGE.exe" "" "$INSTDIR\resources\app.asar.unpacked\assets\skia-forge-app.ico" 0
  DeleteINIStr "$SMPROGRAMS\SKIA FORGE.lnk" "" ""
  CreateShortCut "$SMPROGRAMS\SKIA FORGE.lnk" "$INSTDIR\SKIA-FORGE.exe" "" "$INSTDIR\resources\app.asar.unpacked\assets\skia-forge-app.ico" 0
!macroend

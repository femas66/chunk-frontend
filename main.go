package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
)

func main() {
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	log.Println(filepath.Join("test-chunk", "121", fmt.Sprintf("chunk_%d", 1)))

	log.Println("Server berjalan di http://localhost:2222")
	err := http.ListenAndServe(":2222", nil)
	if err != nil {
		log.Fatal(err)
	}
}

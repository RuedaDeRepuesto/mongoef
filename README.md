# mongoef
POC Simple Mongo mapper

## Descripción

`mongoef` es un mapeador simple para MongoDB que permite interactuar fácilmente con bases de datos utilizando clases y colecciones. Ofrece una interfaz intuitiva para realizar operaciones comunes como guardar, filtrar y eliminar documentos.

## Instalación

Puedes instalar `mongoef` usando npm:

```bash
npm install mongoef
```

## Ejemplo:

```typescript

import {DbContext, Model, MongoEFCollection} from 'mongoef'

class Animal extends Model{
    nombre:string = '';
    color:string = '';
    edad:number = 0;
    dueño?:ObjectId;
}

class TestContext extends DbContext{

    animales:MongoEFCollection<Animal> = new MongoEFCollection<Animal>(Animal);
}


main();

async function main(){
    console.log('Prueba de mongo')
    let context = new TestContext(URL,'testing2',false);
    await context.connect();

    const nuevo = new Animal();
    nuevo.nombre = 'Nuevo as';
    nuevo.edad = 25;
    await nuevo.save(context);

    let todos = await context.animales.all();
    for (const a of todos) {
        a.color = 'rojo';
        await a.save(context);
    }
    console.log('All animals',todos);

    let aborrar = await context.animales.filter({nombre:'Nuevo test'});
    let borrados = await context.animales.delete(aborrar);
    console.log('borrados:',borrados)
}

```
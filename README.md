# mongoef

MongoDB Object Mapper con decoradores al estilo Entity Framework.

## Instalación

```bash
npm install mongoef
```

## Uso básico

```typescript
import { DbContext, Model, MongoEFCollection } from 'mongoef';
import { CollectionName } from 'mongoef';

@CollectionName('animales')
class Animal extends Model {
    nombre: string = '';
    color: string = '';
    edad: number = 0;
}

class AppContext extends DbContext {
    animales: MongoEFCollection<Animal> = new MongoEFCollection(Animal);
}

async function main() {
    const context = new AppContext('mongodb://localhost:27017', 'mi_base', false);
    await context.connect();

    const nuevo = new Animal();
    nuevo.nombre = 'Rex';
    nuevo.edad = 3;
    await nuevo.save(context);

    const todos = await context.animales.all();
    console.log(todos);
}
```

---

## Decoradores

### `@CollectionName(name)`

Define el nombre de la colección en MongoDB. Sin el decorador, se usa el nombre de la clase en minúsculas.

```typescript
@CollectionName('usuarios')
class User extends Model { ... }
```

### `@Column(name)`

Mapea una propiedad TypeScript a un nombre de campo diferente en MongoDB.

```typescript
class User extends Model {
    @Column('first_name')
    firstName: string = '';
}
```

### `@JsonIgnore`

Excluye la propiedad de la serialización JSON (`toJSON()` / `JSON.stringify()`).
La propiedad **sigue guardándose** en MongoDB; solo se oculta en respuestas JSON.

```typescript
class User extends Model {
    @JsonIgnore
    passwordHash: string = '';
}
```

### `@NotMapped`

La propiedad existe en el modelo en memoria pero nunca se persiste en MongoDB.

```typescript
class User extends Model {
    @NotMapped
    sessionToken: string = '';
}
```

### `@ForeignKey(model, localField)`

Define una relación entre modelos para poder hidratarla con `.include()`.

```typescript
class Order extends Model {
    userId: ObjectId = new ObjectId();

    @ForeignKey(() => User, 'userId')
    user?: User;
}
```

### `@Index(key, options?)`

Crea el índice en MongoDB automáticamente al llamar `context.connect()`.

```typescript
@CollectionName('users')
@Index({ email: 1 }, { unique: true })
@Index({ nombre: 'text' })
class User extends Model { ... }
```

### `@SoftDelete`

En lugar de eliminar documentos físicamente, `.delete()` setea el campo `deletedAt`.
Todos los queries excluyen automáticamente los documentos eliminados.

```typescript
@SoftDelete
class Post extends Model {
    titulo: string = '';
}

// Soft delete — setea deletedAt
await context.posts.delete(unPost);

// Incluir eliminados en un query
const todos = await context.posts.query().withDeleted().toList();
```

---

## QueryBuilder

El método `.query()` retorna un builder fluido para componer consultas.

```typescript
const resultados = await context.users
    .query({ activo: true })
    .orderBy('nombre', 'asc')
    .skip(20)
    .take(10)
    .toList();

// Primer resultado
const primero = await context.users.query({ rol: 'admin' }).first();

// Contar
const total = await context.users.query().count();
```

---

## Joins con `include()`

```typescript
const orders = await context.orders
    .query()
    .include('user')      // Hidrata order.user usando $lookup
    .include('product')   // Se puede encadenar
    .orderBy('createdAt', 'desc')
    .toList();

console.log(orders[0].user?.nombre);
```

---

## DbContext

```typescript
class AppContext extends DbContext {
    users: MongoEFCollection<User> = new MongoEFCollection(User);
    posts: MongoEFCollection<Post> = new MongoEFCollection(Post);
}

const context = new AppContext('mongodb://localhost:27017', 'mi_db', false);
await context.connect(); // Inicializa colecciones y crea índices
```

> **Nota:** El parámetro `autoConnect` está deprecado. Siempre usá `false` y llamá `await context.connect()` manualmente.

---

## Script de prueba

Requiere una instancia de MongoDB accesible.

```bash
npm test
# Pide la URL de MongoDB por stdin (por defecto: mongodb://localhost:27017)
# También acepta la variable de entorno MONGO_URL

MONGO_URL=mongodb://localhost:27017 npm test
```
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { Database } from "./database.js";
import { buildRoutePath } from "./utils/build-route-path.js";
import { parse } from "csv-parse";

/* 
  - FUNCIONALIDADES
    - Criação de uma task
    - Listagem de todas as tasks
    - Atualização de uma task pelo `id`
    - Remover uma task pelo `id`
    - Marcar pelo `id` uma task como completa
    - E o verdadeiro desafio: Importação de tasks em massa por um arquivo CSV

  - CAMPOS
    - `id` - Identificador único de cada task
    - `title` - Título da task
    - `description` - Descrição detalhada da task
    - `completed_at` - Data de quando a task foi concluída. O valor inicial deve ser `null`
    - `created_at` - Data de quando a task foi criada.
    - `updated_at` - Deve ser sempre alterado para a data de quando a task foi atualizada.

  - METHOD's
    - POST - /tasks -> Deve ser possível criar uma task no banco de dados, enviando os campos `title` e `description` por meio do `body` da requisição.
    Ao criar uma task, os campos: `id`, `created_at`, `updated_at` e `completed_at` devem ser preenchidos automaticamente, conforme a orientação das propriedades acima.
    
    - GET - /tasks -> Deve ser possível listar todas as tasks salvas no banco de dados.
    Também deve ser possível realizar uma busca, filtrando as tasks pelo `title` e `description`
    
    - PUT - /tasks/:id -> Deve ser possível atualizar uma task pelo `id`.
    No `body` da requisição, deve receber somente o `title` e/ou `description` para serem atualizados.
    Se for enviado somente o `title`, significa que o `description` não pode ser atualizado e vice-versa.
    Antes de realizar a atualização, deve ser feito uma validação se o `id` pertence a uma task salva no banco de dados.
    
    - DELETE - /tasks/:id -> Deve ser possível remover uma task pelo `id`.
    Antes de realizar a remoção, deve ser feito uma validação se o `id` pertence a uma task salva no banco de dados.
    
    - PATCH - /tasks/:id/complete -> Deve ser possível marcar a task como completa ou não. Isso significa que se a task estiver concluída, deve voltar ao seu estado “normal”.
    Antes da alteração, deve ser feito uma validação se o `id` pertence a uma task salva no banco de dados.
*/

const database = new Database();

const csvPath = new URL("./../streams/tasks.csv", import.meta.url);

const stream = fs.createReadStream(csvPath);

const csvParse = parse({
	delimiter: ",",
	skipEmptyLines: true,
	fromLine: 2, // skip the header line
});

export const routes = [
	{
		method: "GET",
		path: buildRoutePath("/tasks"),
		handler: (req, res) => {
			const { search } = req.query;

			const tasks = database.select("tasks", {
				title: search,
				description: search,
			});

			return res.end(JSON.stringify(tasks));
		},
	},
	{
		method: "POST",
		path: buildRoutePath("/tasks/import"),
		handler: async (req, res) => {
			const linesParse = stream.pipe(csvParse);

			console.log(linesParse);

			for await (const line of linesParse) {
				const [title, description] = line;

				if (!title || !description) {
					return res
						.writeHead(400)
						.end(
							JSON.stringify({ message: "title or description are required" })
						);
				}

				const task = {
					id: randomUUID(),
					title,
					description,
					completed_at: null,
					created_at: new Date(),
					updated_at: new Date(),
				};

				database.insert("tasks", task);
			}

			return res.writeHead(201).end();
		},
	},
	{
		method: "POST",
		path: buildRoutePath("/tasks"),
		handler: (req, res) => {
			const { title, description } = req.body;

			if (!title || !description) {
				return res
					.writeHead(400)
					.end(
						JSON.stringify({ message: "title or description are required" })
					);
			}

			const task = {
				id: randomUUID(),
				title,
				description,
				completed_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			database.insert("tasks", task);

			return res.writeHead(201).end();
		},
	},
	{
		method: "PUT",
		path: buildRoutePath("/tasks/:id"),
		handler: (req, res) => {
			const { id } = req.params;
			const { title, description } = req.body;

			if (!title || !description) {
				return res
					.writeHead(400)
					.end(
						JSON.stringify({ message: "title or description are required" })
					);
			}

			const [task] = database.select("tasks", { id });

			if (!task) {
				return res.writeHead(404).end();
			}

			database.update("tasks", id, {
				title,
				description,
				updated_at: new Date(),
			});

			return res.writeHead(204).end();
		},
	},
	{
		method: "DELETE",
		path: buildRoutePath("/tasks/:id"),
		handler: (req, res) => {
			const { id } = req.params;
			const [task] = database.select("tasks", { id });

			if (!task) {
				return res.writeHead(404).end();
			}

			database.delete("tasks", id);
			return res.writeHead(204).end();
		},
	},
	{
		method: "PATCH",
		path: buildRoutePath("/tasks/:id/complete"),
		handler: (req, res) => {
			const { id } = req.params;
			const [task] = database.select("tasks", { id });

			if (!task) {
				return res.writeHead(404).end();
			}

			const isTaskCompleted = !!task.completed_at;
			const completed_at = isTaskCompleted ? null : new Date();

			database.update("tasks", id, { completed_at });

			return res.writeHead(204).end();
		},
	},
];
